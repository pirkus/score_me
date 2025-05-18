(ns myscore.handlers.scorecard-update-test
  (:require
    [clojure.test :refer [deftest is testing]]
    [cheshire.core :as json]
    [myscore.system :as system]
    [monger.collection :as mc]
    [monger.util :as mu]
    [myscore.handlers.handler-test :refer [fresh-db]]))

(deftest update-existing-scorecard-test
  (let [db (fresh-db)
        create-config-handler (system/create-config-handler db)
        create-scorecard-handler (system/create-scorecard-handler db)
        email "test@example.com"
        config-name "Update Test Config"
        config-data {:name config-name
                     :metrics [{:name "Metric1" :scoreType "numeric"}
                               {:name "Metric2" :scoreType "checkbox"}]
                     :email email}
        
        ;; Initial scorecard data
        original-scorecard-data {:email email
                                 :configName config-name
                                 :scores [{:metricName "Metric1" :devScore 7 :mentorScore 8}
                                          {:metricName "Metric2" :devScore false :mentorScore true}]
                                 :startDate "2023-01-01"
                                 :endDate "2023-01-10"
                                 :generalNotes "Original notes"
                                 :dateCreated (.toString (java.time.Instant/now))}]
    
    ;; Create config
    (testing "Setup: Create config and initial scorecard"
      (let [config-response (create-config-handler {:json-params config-data})]
        (is (= 200 (:status config-response))))
      
      ;; Create initial scorecard
      (let [scorecard-response (create-scorecard-handler {:json-params original-scorecard-data})
            body (json/parse-string (:body scorecard-response) true)]
        (is (= 200 (:status scorecard-response)))
        (is (contains? body :id))
        
        ;; Store id for update test
        (let [scorecard-id (:id body)
              
              ;; Updated scorecard data with the same id
              updated-scorecard-data {:_id scorecard-id
                                      :email email
                                      :configName config-name
                                      :scores [{:metricName "Metric1" :devScore 9 :mentorScore 9.5}
                                               {:metricName "Metric2" :devScore true :mentorScore false}]
                                      :startDate "2023-01-01"
                                      :endDate "2023-01-15" ;; Extended end date
                                      :generalNotes "Updated notes"
                                      :dateCreated original-scorecard-data}]
          
          (testing "Update existing scorecard"
            (let [update-response (create-scorecard-handler {:json-params updated-scorecard-data})]
              (is (= 200 (:status update-response)))
              
              ;; Verify that the update was stored correctly
              (let [updated-scorecard (mc/find-map-by-id db "scorecards" (mu/object-id scorecard-id))]
                (is (= "Updated notes" (:generalNotes updated-scorecard)))
                (is (= "2023-01-15" (:endDate updated-scorecard)))
                (is (= 9 (get-in updated-scorecard [:scores 0 :devScore])))
                (is (= 9.5 (get-in updated-scorecard [:scores 0 :mentorScore])))
                (is (= true (get-in updated-scorecard [:scores 1 :devScore])))
                (is (= false (get-in updated-scorecard [:scores 1 :mentorScore]))))))
          ;; Clean up
          (mc/remove db "config" {:email email})
          (mc/remove db "scorecards" {:email email}))))))

(deftest update-overlapping-dates-test
  (let [db (fresh-db)
        create-config-handler (system/create-config-handler db)
        create-scorecard-handler (system/create-scorecard-handler db)
        email "test@example.com"
        config-name "Overlap Test Config"
        
        ;; Setup - create config
        config-data {:name config-name
                     :metrics [{:name "Metric1" :scoreType "numeric"}]
                     :email email}
        
        ;; Create two scorecards with non-overlapping dates
        scorecard1-data {:email email
                        :configName config-name
                        :scores [{:metricName "Metric1" :devScore 7 :mentorScore 8}]
                        :startDate "2023-01-01"
                        :endDate "2023-01-15"
                        :dateCreated (.toString (java.time.Instant/now))}
        
        scorecard2-data {:email email
                        :configName config-name
                        :scores [{:metricName "Metric1" :devScore 8 :mentorScore 9}]
                        :startDate "2023-01-16" 
                        :endDate "2023-01-31"
                        :dateCreated (.toString (java.time.Instant/now))}]
    
    ;; Setup test data  
    (let [config-response (create-config-handler {:json-params config-data})]
      (is (= 200 (:status config-response))))
    
    ;; Create two scorecards
    (let [scorecard1-response (create-scorecard-handler {:json-params scorecard1-data})]
      (is (= 200 (:status scorecard1-response)))
    
      (let [scorecard2-response (create-scorecard-handler {:json-params scorecard2-data})
            scorecard2-body (json/parse-string (:body scorecard2-response) true)
            scorecard2-id (:id scorecard2-body)]
        (is (= 200 (:status scorecard2-response)))
        
        ;; Now try to update the second scorecard with dates that overlap the first
        (testing "Update with overlapping dates should fail"
          (let [overlapping-update {:_id scorecard2-id
                                   :email email
                                   :configName config-name
                                   :scores [{:metricName "Metric1" :devScore 8 :mentorScore 9}]
                                   :startDate "2023-01-10" ;; Now overlaps with scorecard1
                                   :endDate "2023-01-31"
                                   :dateCreated scorecard2-data}
                update-response (create-scorecard-handler {:json-params overlapping-update})]
            (is (= 400 (:status update-response)))
            (let [error-message (get (json/parse-string (:body update-response) true) :error)]
              (is (re-find #"overlaps with an existing scorecard" error-message)))))
        
        ;; Test that you can update a scorecard with its own date range
        (testing "Update with same scorecard's own date range should succeed"
          (let [self-update {:_id scorecard2-id
                            :email email
                            :configName config-name
                            :scores [{:metricName "Metric1" :devScore 9 :mentorScore 10}]
                            :startDate "2023-01-16" ;; Same as original
                            :endDate "2023-01-31"   ;; Same as original
                            :dateCreated scorecard2-data}
                update-response (create-scorecard-handler {:json-params self-update})]
            (is (= 200 (:status update-response)))
            (let [updated (mc/find-map-by-id db "scorecards" (mu/object-id scorecard2-id))]
              (is (= 9 (get-in updated [:scores 0 :devScore]))))))
        
        ;; Clean up
        (mc/remove db "config" {:email email})
        (mc/remove db "scorecards" {:email email})))))

(deftest update-archived-scorecard-test
  (let [db (fresh-db)
        create-config-handler (system/create-config-handler db)
        create-scorecard-handler (system/create-scorecard-handler db)
        archive-handler (system/archive-scorecard-handler db)
        email "test@example.com"
        config-name "Archive Update Test"
        
        ;; Setup - create config
        config-data {:name config-name
                     :metrics [{:name "Metric1" :scoreType "numeric"}]
                     :email email}
        
        ;; Initial scorecard
        scorecard-data {:email email
                       :configName config-name
                       :scores [{:metricName "Metric1" :devScore 7 :mentorScore 8}]
                       :startDate "2023-01-01"
                       :endDate "2023-01-15"
                       :dateCreated (.toString (java.time.Instant/now))}]
    
    ;; Setup test data
    (let [config-response (create-config-handler {:json-params config-data})]
      (is (= 200 (:status config-response))))
    
    (let [scorecard-response (create-scorecard-handler {:json-params scorecard-data})
          scorecard-body (json/parse-string (:body scorecard-response) true)
          scorecard-id (:id scorecard-body)]
      (is (= 200 (:status scorecard-response)))
      
      ;; Archive the scorecard
      (let [archive-response (archive-handler {:path-params {:id scorecard-id}})]
        (is (= 200 (:status archive-response)))
        
        ;; Verify it was archived
        (let [archived-scorecard (mc/find-map-by-id db "scorecards" (mu/object-id scorecard-id))]
          (is (true? (:archived archived-scorecard))))
        
        ;; Now try to update the archived scorecard
        (testing "Update of archived scorecard"
          (let [update-data {:_id scorecard-id
                            :email email
                            :configName config-name
                            :scores [{:metricName "Metric1" :devScore 9 :mentorScore 10}]
                            :startDate "2023-01-01"
                            :endDate "2023-01-15"
                            :dateCreated scorecard-data}
                update-response (create-scorecard-handler {:json-params update-data})]
            
            ;; Should succeed (update is allowed for archived scorecards)
            (is (= 200 (:status update-response)))
            
            ;; Verify the update was applied but archived status remains
            (let [updated (mc/find-map-by-id db "scorecards" (mu/object-id scorecard-id))]
              (is (= 9 (get-in updated [:scores 0 :devScore])))
              (is (true? (:archived updated))))))))
    
    ;; Clean up
    (mc/remove db "config" {:email email})
    (mc/remove db "scorecards" {:email email})))