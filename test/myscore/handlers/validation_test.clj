(ns myscore.handlers.validation-test
  (:require
   [clojure.test :refer [deftest is testing]]
   [myscore.system :as system]
   [myscore.specs :as specs]
   [clojure.spec.alpha :as s]))

(deftest validate-create-config-test
  (testing "interceptor passes for valid config parameters"
    (let [interceptor (system/validate-create-config)
          valid-params {:name "Test Config"
                        :email "test@example.com"
                        :metrics [{:name "Metric1" 
                                   :expectation "Expected behavior"
                                   :scoreType "numeric"}]}
          context {:request {:json-params valid-params}}
          result ((:enter interceptor) context)]
      (is (= context result))
      (is (nil? (:response result)))))
  
  (testing "interceptor returns 400 for invalid config parameters"
    (let [interceptor (system/validate-create-config)
          ;; Missing required fields
          invalid-params {:name "Test Config"}
          context {:request {:json-params invalid-params}}
          result ((:enter interceptor) context)]
      (is (not= context result))
      (is (= 400 (get-in result [:response :status]))))))

(deftest validate-create-scorecard-test
  (testing "interceptor passes for valid scorecard parameters"
    (let [interceptor (system/validate-create-scorecard)
          valid-params {:email "test@example.com"
                        :configName "Test Config"
                        :scores [{:metricName "Metric1" :devScore 8 :mentorScore 9}]
                        :startDate "2023-01-01"
                        :endDate "2023-01-10"
                        :dateCreated "2023-01-01T12:00:00Z"}
          context {:request {:json-params valid-params}}
          result ((:enter interceptor) context)]
      (is (= context result))
      (is (nil? (:response result)))))
  
  (testing "interceptor returns 400 for invalid scorecard parameters"
    (let [interceptor (system/validate-create-scorecard)
          ;; Missing required fields
          invalid-params {:email "test@example.com"}
          context {:request {:json-params invalid-params}}
          result ((:enter interceptor) context)]
      (is (not= context result))
      (is (= 400 (get-in result [:response :status]))))))

(deftest create-config-handler-test
  (testing "valid specs for config creation"
    (is (s/valid? ::specs/create-config-params 
                 {:name "Test Config"
                  :email "test@example.com"
                  :metrics [{:name "Metric1" 
                            :expectation "Expected behavior"
                            :scoreType "numeric"}]}))
    
    (is (s/valid? ::specs/create-config-params 
                 {:name "Test Config"
                  :email "test@example.com"
                  :metrics [{:name "Metric1" 
                            :expectation "Expected behavior"
                            :scoreType "checkbox"}
                           {:name "Metric2"
                            :expectation "Another expectation"
                            :scoreType "numeric"}]})))
  
  (testing "invalid specs for config creation"
    (is (not (s/valid? ::specs/create-config-params {:name "Test Config"})))
    (is (not (s/valid? ::specs/create-config-params {:email "test@example.com"})))
    (is (not (s/valid? ::specs/create-config-params 
                       {:name "Test Config"
                        :email "test@example.com"
                        :metrics [{}]})))
    (is (not (s/valid? ::specs/create-config-params 
                       {:name "Test Config"
                        :email "test@example.com"
                        :metrics [{:scoreType "numeric"}]})))
    (is (not (s/valid? ::specs/create-config-params 
                       {:name "Test Config"
                        :email "test@example.com"
                        :metrics [{:name "Metric1"
                                  :scoreType "numeric"}]})))))

(deftest validate-score-types-test
  (testing "valid numeric scores"
    (let [config {:metrics [{:name "M1" :scoreType "numeric"}
                            {:name "M2" :scoreType "numeric"}]}
          scores [{:metricName "M1" :devScore 8 :mentorScore 9}
                  {:metricName "M2" :devScore 0 :mentorScore 10}]]
      (is (true? (system/validate-score-types config scores)))))
  
  (testing "valid checkbox scores"
    (let [config {:metrics [{:name "M1" :scoreType "checkbox"}
                            {:name "M2" :scoreType "checkbox"}]}
          scores [{:metricName "M1" :devScore true :mentorScore false}
                  {:metricName "M2" :devScore false :mentorScore true}]]
      (is (true? (system/validate-score-types config scores)))))
  
  (testing "valid mixed score types"
    (let [config {:metrics [{:name "M1" :scoreType "numeric"}
                            {:name "M2" :scoreType "checkbox"}]}
          scores [{:metricName "M1" :devScore 8 :mentorScore 9}
                  {:metricName "M2" :devScore true :mentorScore false}]]
      (is (true? (system/validate-score-types config scores)))))
  
  (testing "invalid numeric scores (out of range)"
    (let [config {:metrics [{:name "M1" :scoreType "numeric"}]}
          scores-too-high [{:metricName "M1" :devScore 11 :mentorScore 9}]
          scores-too-low [{:metricName "M1" :devScore -1 :mentorScore 9}]
          scores-wrong-type [{:metricName "M1" :devScore "8" :mentorScore 9}]]
      (is (false? (system/validate-score-types config scores-too-high)))
      (is (false? (system/validate-score-types config scores-too-low)))
      (is (false? (system/validate-score-types config scores-wrong-type)))))
  
  (testing "invalid checkbox scores (wrong type)"
    (let [config {:metrics [{:name "M1" :scoreType "checkbox"}]}
          scores-wrong-type [{:metricName "M1" :devScore 1 :mentorScore false}]]
      (is (false? (system/validate-score-types config scores-wrong-type)))))
  
  (testing "unknown metric name"
    (let [config {:metrics [{:name "M1" :scoreType "numeric"}]}
          scores [{:metricName "Unknown" :devScore 8 :mentorScore 9}]]
      (is (false? (system/validate-score-types config scores)))))

  (testing "edge cases"
    (is (false? (system/validate-score-types nil nil)))
    (is (false? (system/validate-score-types {} [])))
    (is (false? (system/validate-score-types {:metrics []} [])))))