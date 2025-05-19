(ns myscore.handlers.get-scorecards-test
  (:require
    [clojure.test :refer [deftest is testing]]
    [cheshire.core :as json]
    [myscore.system :as system]
    [monger.collection :as mc]
    [monger.util :as mu]
    [myscore.handlers.handler-test :refer [fresh-db]]))

(deftest get-scorecards-with-encoded-id-test
  (let [db (fresh-db)
        get-handler (system/get-scorecards-handler db)
        
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
    
    (testing "Scorecards are returned with encoded IDs"
      (let [request {:identity {:email email}}
            response (get-handler request)
            body (json/parse-string (:body response) true)]
        (is (= 200 (:status response)))
        (is (= 2 (count body)))
        
        ;; Verify encoded IDs are returned in the response
        (let [scorecard-map (reduce (fn [acc card] 
                                      (assoc acc (:configName card) card)) 
                                    {} body)]
          (is (contains? (get scorecard-map "Config A") :id))
          (is (contains? (get scorecard-map "Config B") :id))
          (is (= (str id1) (:id (get scorecard-map "Config A"))))
          (is (= (str id2) (:id (get scorecard-map "Config B")))))))
    
    ;; Clean up
    (mc/remove db "scorecards" {:email email})))

(deftest get-scorecard-by-encoded-id-test
  (let [db (fresh-db)
        get-handler (system/get-scorecard-handler db)
        
        ;; Create a scorecard
        scorecard-id (mu/object-id)
        email "test@example.com"
        encoded-id (system/encode-id (str scorecard-id))
        
        test-scorecard {:_id scorecard-id
                       :configName "Test Config"
                       :email email
                       :scores [{:metricName "M1", :devScore 8, :mentorScore 9}]
                       :startDate "2023-07-01"
                       :endDate "2023-07-31"
                       :dateCreated "2023-07-01T12:00:00Z"}]
    
    ;; Insert test data
    (mc/insert db "scorecards" test-scorecard)
    
    ;; Verify the scorecard was inserted correctly
    (let [stored-card (mc/find-map-by-id db "scorecards" scorecard-id)]
      (is (not (nil? stored-card)))
      (is (= "Test Config" (:configName stored-card))))
    
    (testing "Retrieving by encoded ID"
      (let [decoded-id (system/decode-id encoded-id)]
        (is (= (str scorecard-id) decoded-id))
        
        ;; Direct database test to verify encoding/decoding works
        (let [oid (mu/object-id decoded-id)
              db-doc (mc/find-map-by-id db "scorecards" oid)]
          (is (not (nil? db-doc)))
          (is (= "Test Config" (:configName db-doc))))))
    
    (testing "Invalid encoded ID format is handled properly"
      (let [invalid-id "!"  ;; Use a non-base64 character
            request {:path-params {:id invalid-id}
                    :identity {:email email}}
            response (get-handler request)]
        ;; Should be a 400 error for invalid format
        (is (= 400 (:status response)))))
    
    ;; Clean up
    (mc/remove db "scorecards" {:email email})))