(ns myscore.handlers.archive-test
  (:require
    [clojure.test :refer [deftest is testing use-fixtures]]
    [cheshire.core :as json]
    [myscore.system :as system]
    [monger.core :as mg]
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
                     :query-params {"includeArchived" "true"}}
            response (get-handler request)
            body (json/parse-string (:body response) true)]
        (is (= 200 (:status response)))
        (is (= 3 (count body)))
        (is (= #{"Active Config" "Archived Config 1" "Archived Config 2"} 
               (set (map :configName body))))))
    
    (testing "includeArchived must be exactly 'true' to include archived scorecards"
      (let [request {:identity {:email email}
                     :query-params {"includeArchived" "yes"}}
            response (get-handler request)
            body (json/parse-string (:body response) true)]
        (is (= 200 (:status response)))
        (is (= 1 (count body)))
        (is (= "Active Config" (:configName (first body))))))
    
    (testing "Other user's scorecards are not returned"
      (let [other-email "other@example.com"
            request {:identity {:email other-email}
                     :query-params {"includeArchived" "true"}}
            response (get-handler request)
            body (json/parse-string (:body response) true)]
        (is (= 200 (:status response)))
        (is (= 0 (count body))))))) 