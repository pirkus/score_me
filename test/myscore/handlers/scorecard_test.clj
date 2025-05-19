(ns myscore.handlers.scorecard-test
  (:require
    [clojure.test :refer [deftest is]]
    [cheshire.core :as json]
    [myscore.system :as system]
    [monger.collection :as mc]
    [monger.util :as mu]
    [myscore.handlers.handler-test :refer [fresh-db]]))

(deftest scorecard-with-score-type-test
  (let [db (fresh-db)
        create-config-handler (system/create-config-handler db)
        create-scorecard-handler (system/create-scorecard-handler db)
        email "test@example.com"
        config-name "Test Config"
        config-data {:name config-name
                     :metrics [{:name "Metric1" 
                               :expectation "Track checkbox values"
                               :scoreType "checkbox"}]
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
        (is (contains? body :encodedId))
        (is (= (system/encode-id (:id body)) (:encodedId body)))
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
                     :metrics [{:name "Numeric Metric" 
                               :expectation "Rate 0-10"
                               :scoreType "numeric"}
                              {:name "Checkbox Metric"
                               :expectation "Yes/No tracking"
                               :scoreType "checkbox"}]
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
        (is (contains? body :encodedId))
        (is (= (system/encode-id (:id body)) (:encodedId body)))
        (let [created (mc/find-one-as-map db "scorecards" {:email email})]
          (is (= 8.5 (get-in created [:scores 0 :devScore])))
          (is (= true (get-in created [:scores 1 :devScore]))))))
    
    ;; Clean up
    (mc/remove db "config" {:email email})
    (mc/remove db "scorecards" {:email email})))