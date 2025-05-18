(ns myscore.handlers.scorecard-test
  (:require
    [clojure.test :refer [deftest is testing]]
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
            scorecard-id (:id body)
            update-data (assoc scorecard-data :_id scorecard-id
                               :scores [{:metricName "Numeric Metric" :devScore 9.5 :mentorScore 10.0}
                                        {:metricName "Checkbox Metric" :devScore false :mentorScore true}])
            update-response (create-scorecard-handler {:json-params update-data})]
        
        ;; Update scores using create endpoint
        
        (is (= 200 (:status update-response)))
        (let [updated (mc/find-one-as-map db "scorecards" {:_id (mu/object-id scorecard-id)})]
          (is (= 9.5 (get-in updated [:scores 0 :devScore])))
          (is (= false (get-in updated [:scores 1 :devScore])))))
    
    ;; Clean up
    (mc/remove db "config" {:email email})
    (mc/remove db "scorecards" {:email email}))))