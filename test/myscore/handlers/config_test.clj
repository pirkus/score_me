(ns myscore.handlers.config-test
  (:require
    [clojure.test :refer [deftest is testing]]
    [cheshire.core :as json]
    [myscore.system :as system]
    [monger.collection :as mc]
    [monger.util :as mu]
    [myscore.handlers.handler-test :refer [fresh-db]]))

(deftest create-config-handler-test
  (let [db (fresh-db)
        handler (system/create-config-handler db)
        email "test@example.com"
        config-data {:name "Test Config"
                     :email email
                     :metrics [{:name "Metric1" 
                               :expectation "Expected behavior"
                               :scoreType "numeric"}
                              {:name "Metric2" 
                               :expectation "Another expectation"
                               :scoreType "checkbox"}]}]
    
    ;; First, ensure collection has unique index
    (mc/ensure-index db "config" (array-map :email 1 :name 1) {:unique true})
    
    (testing "Creating a new config"
      (let [response (handler {:json-params config-data})
            body (json/parse-string (:body response) true)]
        (is (= 200 (:status response)))
        (is (= "saved" (:result body)))
        (is (string? (:id body)))
        
        ;; Verify it was saved in the database
        (let [saved-config (mc/find-one-as-map db "config" {:email email})]
          (is (not (nil? saved-config)))
          (is (= "Test Config" (:name saved-config)))
          (is (= 2 (count (:metrics saved-config))))
          (is (= "numeric" (get-in saved-config [:metrics 0 :scoreType])))
          (is (= "checkbox" (get-in saved-config [:metrics 1 :scoreType]))))))
    
    (testing "Creating a duplicate config (same name and email)"
      (let [response (handler {:json-params config-data})
            body (json/parse-string (:body response) true)]
        ;; With unique index, this should fail
        (is (= 400 (:status response)))
        (is (contains? body :error))))
    
    ;; Remove unique index for remaining tests
    (mc/drop-index db "config" "email_1_name_1")
    
    (testing "Config allows missing expectation field"
      (let [minimal-config {:name "Minimal Config"
                           :email email
                           :metrics [{:name "Minimal Metric" 
                                     :scoreType "numeric"}]}
            response (handler {:json-params minimal-config})]
        ;; This should still succeed without expectation field
        (is (= 200 (:status response)))
        (is (= "saved" (get (json/parse-string (:body response) true) :result)))))
    
    (testing "Config allows empty metrics"
      (let [empty-metrics-data (assoc config-data :metrics [])
            response (handler {:json-params empty-metrics-data})]
        ;; This would normally fail spec validation, but we test directly with handler
        ;; Handler doesn't validate metrics array
        (is (= 200 (:status response)))
        (is (= "saved" (get (json/parse-string (:body response) true) :result))))
      ;; Clean up 
      (mc/remove db "config" {:email email}))))

(deftest get-configs-handler-test
  (let [db (fresh-db)
        create-handler (system/create-config-handler db)
        get-handler (system/get-configs-handler db)
        email "test@example.com"
        other-email "other@example.com"
        
        ;; Create multiple configs
        config1 {:name "Config 1"
                :email email
                :metrics [{:name "Metric1" 
                          :expectation "Expected behavior"
                          :scoreType "numeric"}]}
        
        config2 {:name "Config 2"
                :email email
                :metrics [{:name "Metric2" 
                          :expectation "Another expectation"
                          :scoreType "checkbox"}]}
        
        other-config {:name "Other Config"
                     :email other-email
                     :metrics [{:name "OtherMetric" 
                               :expectation "Other expectation"
                               :scoreType "numeric"}]}]
    
    ;; Insert configs
    (create-handler {:json-params config1})
    (create-handler {:json-params config2})
    (create-handler {:json-params other-config})
    
    (testing "Get configs for a user"
      (let [request {:identity {:email email}}
            response (get-handler request)
            body (json/parse-string (:body response) true)]
        (is (= 200 (:status response)))
        (is (= 2 (count body)))
        
        ;; Ensure correct configs are returned
        (let [names (set (map :name body))]
          (is (contains? names "Config 1"))
          (is (contains? names "Config 2"))
          (is (not (contains? names "Other Config"))))))
    
    (testing "Get configs for another user"
      (let [response (get-handler {:identity {:email other-email}})
            body (json/parse-string (:body response) true)]
        (is (= 200 (:status response)))
        (is (= 1 (count body)))
        (is (= "Other Config" (:name (first body))))))
    
    (testing "Get configs for user with no configs"
      (let [response (get-handler {:identity {:email "nonexistent@example.com"}})
            body (json/parse-string (:body response) true)]
        (is (= 200 (:status response)))
        (is (empty? body)))))) 