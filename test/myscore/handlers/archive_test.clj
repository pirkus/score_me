(ns myscore.handlers.archive-test
  (:require
    [clojure.test :refer [deftest is testing]]
    [cheshire.core :as json]
    [myscore.system :as system :refer [find-overlapping-scorecard]]
    [monger.collection :as mc]
    [monger.util :as mu]
    [myscore.handlers.handler-test :refer [fresh-db]]))

;; Use the fresh-db function from handler-test

(deftest archive-scorecard-handler-test
  (let [db (fresh-db)
        handler (system/archive-scorecard-handler db)
        
        ;; Insert a test scorecard
        scorecard-id (mu/object-id)
        test-scorecard {:_id scorecard-id
                        :configName "Test Config"
                        :email "test@example.com"
                        :scores [{:metricName "Metric1"
                                  :devScore 8.5
                                  :mentorScore 9.0}]
                        :startDate "2023-07-01"
                        :endDate "2023-07-31"
                        :dateCreated "2023-07-01T12:00:00Z"
                        :archived false}]
    
    ;; Insert test scorecard into DB
    (mc/insert db "scorecards" test-scorecard)
    
    (testing "Successfully archive existing scorecard"
      (let [request {:path-params {:id (str scorecard-id)}}
            response (handler request)
            body (json/parse-string (:body response) true)]
        (is (= 200 (:status response)))
        (is (= "archived" (:result body)))
        (is (= (str scorecard-id) (:id body)))
        
        ;; Verify scorecard is archived in DB
        (let [updated (mc/find-map-by-id db "scorecards" scorecard-id)]
          (is (true? (:archived updated))))))
    
    (testing "Try to archive non-existent scorecard"
      (let [non-existent-id (mu/object-id)
            request {:path-params {:id (str non-existent-id)}}
            response (handler request)]
        (is (= 404 (:status response)))
        (let [body (json/parse-string (:body response) true)]
          (is (= "Scorecard not found" (:error body))))))
    
    (testing "Invalid ID format rejection"
      (let [request {:path-params {:id "invalid-id-format"}}
            response (handler request)]
        (is (= 400 (:status response)))
        (let [body (json/parse-string (:body response) true)]
          (is (= "Invalid ID format" (:error body))))))))

(deftest archive-scorecard-filtering-test
  (let [db (fresh-db)
        get-handler (system/get-scorecards-handler db)
        archive-handler (system/archive-scorecard-handler db)
        
        ;; Insert test scorecards
        id1 (mu/object-id)
        id2 (mu/object-id)
        email "test@example.com"
        
        scorecard1 {:_id id1
                   :configName "Config A"
                   :email email
                   :scores [{:metricName "M1", :devScore 8, :mentorScore 9}]
                   :startDate "2023-07-01"
                   :endDate "2023-07-31"
                   :dateCreated "2023-07-01T12:00:00Z"}
        
        scorecard2 {:_id id2
                   :configName "Config B" 
                   :email email
                   :scores [{:metricName "M1", :devScore 7, :mentorScore 8}]
                   :startDate "2023-08-01"
                   :endDate "2023-08-31"
                   :dateCreated "2023-08-01T12:00:00Z"}]
    
    ;; Insert test data
    (mc/insert-batch db "scorecards" [scorecard1 scorecard2])
    
    (testing "Initially both scorecards are returned"
      (let [request {:identity {:email email}}
            response (get-handler request)
            body (json/parse-string (:body response) true)]
        (is (= 200 (:status response)))
        (is (= 2 (count body)))
        (is (= #{"Config A" "Config B"} 
               (set (map :configName body))))))
    
    (testing "After archiving, scorecard is filtered out"
      ;; Archive the first scorecard
      (let [archive-request {:path-params {:id (str id1)}}
            archive-response (archive-handler archive-request)]
        (is (= 200 (:status archive-response))))
      
      ;; Check that only non-archived scorecards are returned
      (let [request {:identity {:email email}}
            response (get-handler request)
            body (json/parse-string (:body response) true)]
        (is (= 200 (:status response)))
        (is (= 1 (count body)))
        (is (= "Config B" (:configName (first body))))))))

(deftest include-archived-scorecards-test
  (let [db (fresh-db)
        get-handler (system/get-scorecards-handler db)
        
        ;; Insert test scorecards
        id1 (mu/object-id)
        id2 (mu/object-id)
        id3 (mu/object-id)
        email "test@example.com"
        
        ;; Active scorecard
        scorecard1 {:_id id1
                   :configName "Active Config"
                   :email email
                   :scores [{:metricName "M1", :devScore 8, :mentorScore 9}]
                   :startDate "2023-07-01"
                   :endDate "2023-07-31"
                   :dateCreated "2023-07-01T12:00:00Z"
                   :archived false}
        
        ;; Archived scorecard
        scorecard2 {:_id id2
                   :configName "Archived Config 1" 
                   :email email
                   :scores [{:metricName "M1", :devScore 7, :mentorScore 8}]
                   :startDate "2023-06-01"
                   :endDate "2023-06-30"
                   :dateCreated "2023-06-01T12:00:00Z"
                   :archived true}
        
        ;; Another archived scorecard
        scorecard3 {:_id id3
                    :configName "Archived Config 2" 
                    :email email
                    :scores [{:metricName "M1", :devScore 6, :mentorScore 7}]
                    :startDate "2023-05-01"
                    :endDate "2023-05-31"
                    :dateCreated "2023-05-01T12:00:00Z"
                    :archived true}]
    
    ;; Insert test data
    (mc/insert-batch db "scorecards" [scorecard1 scorecard2 scorecard3])
    
    (testing "Only non-archived scorecards are returned by default"
      (let [request {:identity {:email email}}
            response (get-handler request)
            body (json/parse-string (:body response) true)]
        (is (= 200 (:status response)))
        (is (= 1 (count body)))
        (is (= "Active Config" (:configName (first body))))))
    
    (testing "All scorecards are returned when includeArchived is true"
      (let [request {:identity {:email email}
                     :query-params {:includeArchived "true"}}
            response (get-handler request)
            body (json/parse-string (:body response) true)]
        (is (= 200 (:status response)))
        (is (= 3 (count body)))
        (is (= #{"Active Config" "Archived Config 2" "Archived Config 1"} 
               (set (map :configName body))))))
    
    (testing "includeArchived must be exactly 'true' to include archived scorecards"
      (let [request {:identity {:email email}
                     :query-params {:includeArchived "yes"}}
            response (get-handler request)
            body (json/parse-string (:body response) true)]
        (is (= 200 (:status response)))
        (is (= 1 (count body)))
        (is (= "Active Config" (:configName (first body))))))
    
    (testing "Other user's scorecards are not returned"
      (let [other-email "other@example.com"
            request {:identity {:email other-email}
                     :query-params {:includeArchived "true"}}
            response (get-handler request)
            body (json/parse-string (:body response) true)]
        (is (= 200 (:status response)))
        (is (= 0 (count body)))))))

(deftest find-overlapping-scorecard-test
  (let [db (fresh-db)
        email "test@example.com"
        configA "configA"
        configB "configB"
        start-date "2023-01-01"
        end-date "2023-01-10"]

    ;; Clean up before
    (mc/remove db "scorecards" {:email email})

    (testing "overlap with same configName is found"
      (let [overlap {:email email :configName configA :startDate "2023-01-05" :endDate "2023-01-15"}]
        (mc/insert db "scorecards" overlap)
        (let [result (find-overlapping-scorecard db email configA start-date end-date)]
          (is (not (nil? result)))
          (is (= (:configName result) configA)))
        (mc/remove db "scorecards" {:email email :configName configA})))

    (testing "overlap with different configName is not found"
      (let [overlap {:email email :configName configB :startDate "2023-01-05" :endDate "2023-01-15"}]
        (mc/insert db "scorecards" overlap)
        (let [result (find-overlapping-scorecard db email configA start-date end-date)]
          (is (nil? result)))
        (mc/remove db "scorecards" {:email email :configName configB})))

    (testing "no overlap returns nil"
      (let [non-overlap {:email email :configName configA :startDate "2023-02-01" :endDate "2023-02-10"}]
        (mc/insert db "scorecards" non-overlap)
        (let [result (find-overlapping-scorecard db email configA start-date end-date)]
          (is (nil? result)))
        (mc/remove db "scorecards" {:email email :configName configA})))

    (testing "multiple overlaps returns at least one"
      (let [overlap1 {:email email :configName configA :startDate "2023-01-05" :endDate "2023-01-15"}
            overlap2 {:email email :configName configA :startDate "2023-01-08" :endDate "2023-01-20"}]
        (mc/insert-batch db "scorecards" [overlap1 overlap2])
        (let [result (find-overlapping-scorecard db email configA start-date end-date)]
          (is (not (nil? result)))
          (is (= (:configName result) configA)))
        (mc/remove db "scorecards" {:email email :configName configA})))

    (testing "edge case: end date of one is start date of another (should overlap)"
      (let [edge {:email email :configName configA :startDate "2023-01-10" :endDate "2023-01-20"}]
        (mc/insert db "scorecards" edge)
        (let [result (find-overlapping-scorecard db email configA start-date end-date)]
          (is (not (nil? result))))
        (mc/remove db "scorecards" {:email email :configName configA})))

    ;; Clean up after
    (mc/remove db "scorecards" {:email email})))

(deftest scorecard-with-score-type-test
  (let [db (fresh-db)
        create-config-handler (system/create-config-handler db)
        create-scorecard-handler (system/create-scorecard-handler db)
        email "test@example.com"
        config-name "Test Config"
        config-data {:name config-name
                     :metrics [{:name "Metric1" :scoreType "checkbox"}]
                     :email email}
        scorecard-data {:email email
                        :configName config-name
                        :scores [{:metricName "Metric1" :devScore true :mentorScore false}]
                        :startDate "2023-01-01"
                        :endDate "2023-01-10"
                        :dateCreated (.toString (java.time.Instant/now))}]
    ;; Insert config
    (let [config-response (create-config-handler {:json-params config-data})]
      (is (= 200 (:status config-response))))
    ;; Create scorecard
    (let [scorecard-response (create-scorecard-handler {:json-params scorecard-data})]
      (is (= 200 (:status scorecard-response)))
      (let [body (json/parse-string (:body scorecard-response) true)]
        (is (contains? body :id))
        (let [created (mc/find-one-as-map db "scorecards" {:email email})]
          (is (= true (get-in created [:scores 0 :devScore]))))))
    ;; Clean up
    (mc/remove db "config" {:email email})
    (mc/remove db "scorecards" {:email email})))

(deftest mixed-score-types-test
  (let [db (fresh-db)
        create-config-handler (system/create-config-handler db)
        create-scorecard-handler (system/create-scorecard-handler db)
        email "test@example.com"
        config-name "Mixed Score Types Config"
        config-data {:name config-name
                     :metrics [{:name "Numeric Metric" :scoreType "numeric"}
                              {:name "Checkbox Metric" :scoreType "checkbox"}]
                     :email email}
        scorecard-data {:email email
                        :configName config-name
                        :scores [{:metricName "Numeric Metric" :devScore 8.5 :mentorScore 9.0}
                                {:metricName "Checkbox Metric" :devScore true :mentorScore false}]
                        :startDate "2023-01-01"
                        :endDate "2023-01-10"
                        :dateCreated (.toString (java.time.Instant/now))}]
    
    ;; Create config with mixed score types
    (let [config-response (create-config-handler {:json-params config-data})]
      (is (= 200 (:status config-response)))
      (let [body (json/parse-string (:body config-response) true)]
        (is (contains? body :id))
        (let [created (mc/find-one-as-map db "config" {:email email})]
          (is (= "numeric" (get-in created [:metrics 0 :scoreType])))
          (is (= "checkbox" (get-in created [:metrics 1 :scoreType]))))))
    
    ;; Create scorecard with mixed score types
    (let [scorecard-response (create-scorecard-handler {:json-params scorecard-data})]
      (is (= 200 (:status scorecard-response)))
      (let [body (json/parse-string (:body scorecard-response) true)]
        (is (contains? body :id))
        (let [created (mc/find-one-as-map db "scorecards" {:email email})]
          (is (= 8.5 (get-in created [:scores 0 :devScore])))
          (is (= true (get-in created [:scores 1 :devScore]))))))
    
    ;; Clean up
    (mc/remove db "config" {:email email})
    (mc/remove db "scorecards" {:email email})))

(deftest score-type-validation-test
  (let [db (fresh-db)
        create-config-handler (system/create-config-handler db)
        create-scorecard-handler (system/create-scorecard-handler db)
        email "test@example.com"
        config-name "Validation Test Config"
        config-data {:name config-name
                     :metrics [{:name "Numeric Metric" :scoreType "numeric"}
                              {:name "Checkbox Metric" :scoreType "checkbox"}]
                     :email email}]
    
    ;; Create config
    (let [config-response (create-config-handler {:json-params config-data})]
      (is (= 200 (:status config-response))))
    
    ;; Test invalid numeric score for checkbox metric
    (let [invalid-scorecard {:email email
                            :configName config-name
                            :scores [{:metricName "Numeric Metric" :devScore 8.5 :mentorScore 9.0}
                                    {:metricName "Checkbox Metric" :devScore 5 :mentorScore false}]
                            :startDate "2023-01-01"
                            :endDate "2023-01-10"
                            :dateCreated (.toString (java.time.Instant/now))}
          response (create-scorecard-handler {:json-params invalid-scorecard})]
      (is (= 400 (:status response)))
      (let [body (json/parse-string (:body response) true)]
        (is (contains? body :error))))
    
    ;; Test invalid checkbox score for numeric metric
    (let [invalid-scorecard {:email email
                            :configName config-name
                            :scores [{:metricName "Numeric Metric" :devScore true :mentorScore 9.0}
                                    {:metricName "Checkbox Metric" :devScore true :mentorScore false}]
                            :startDate "2023-01-01"
                            :endDate "2023-01-10"
                            :dateCreated (.toString (java.time.Instant/now))}
          response (create-scorecard-handler {:json-params invalid-scorecard})]
      (is (= 400 (:status response)))
      (let [body (json/parse-string (:body response) true)]
        (is (contains? body :error))))
    
    ;; Clean up
    (mc/remove db "config" {:email email})
    (mc/remove db "scorecards" {:email email})))

(deftest update-score-types-test
  (let [db (fresh-db)
        create-config-handler (system/create-config-handler db)
        create-scorecard-handler (system/create-scorecard-handler db)
        email "test@example.com"
        config-name "Update Test Config"
        config-data {:name config-name
                     :metrics [{:name "Numeric Metric" :scoreType "numeric"}
                              {:name "Checkbox Metric" :scoreType "checkbox"}]
                     :email email}
        scorecard-data {:email email
                        :configName config-name
                        :scores [{:metricName "Numeric Metric" :devScore 8.5 :mentorScore 9.0}
                                {:metricName "Checkbox Metric" :devScore true :mentorScore false}]
                        :startDate "2023-01-01"
                        :endDate "2023-01-10"
                        :dateCreated (.toString (java.time.Instant/now))}]
    
    ;; Create config and initial scorecard
    (let [config-response (create-config-handler {:json-params config-data})]
      (is (= 200 (:status config-response))))
    
    (let [scorecard-response (create-scorecard-handler {:json-params scorecard-data})]
      (is (= 200 (:status scorecard-response)))
      (let [body (json/parse-string (:body scorecard-response) true)
            scorecard-id (:id body)]
        
        ;; Update scores using create endpoint
        (let [update-data (assoc scorecard-data :_id scorecard-id
                                :scores [{:metricName "Numeric Metric" :devScore 9.5 :mentorScore 10.0}
                                        {:metricName "Checkbox Metric" :devScore false :mentorScore true}])
              update-response (create-scorecard-handler {:json-params update-data})]
          (is (= 200 (:status update-response)))
          (let [updated (mc/find-one-as-map db "scorecards" {:_id (mu/object-id scorecard-id)})]
            (is (= 9.5 (get-in updated [:scores 0 :devScore])))
            (is (= false (get-in updated [:scores 1 :devScore]))))))
    
    ;; Clean up
    (mc/remove db "config" {:email email})
    (mc/remove db "scorecards" {:email email})))) 