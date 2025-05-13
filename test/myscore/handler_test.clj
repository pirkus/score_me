(ns myscore.handler-test
  (:require
    [clojure.test :refer [deftest is testing use-fixtures]]
    [cheshire.core :as json]
    [myscore.system :as system]
    [clojure.spec.alpha :as s]
    [monger.core :as mg]
    [monger.collection :as mc])
  (:import
    [org.testcontainers.containers MongoDBContainer]
    [org.testcontainers.utility DockerImageName]))

(defonce ^:private mongo-container
  (-> (DockerImageName/parse "mongo:latest")
      (MongoDBContainer.)
      (.withExposedPorts (into-array Integer [(int 27017)]))))

(defn- start-mongo []
  (.start mongo-container)
  mongo-container)

(defn- stop-mongo []
  (.stop mongo-container))

(use-fixtures
  :once
  (fn [f]
    (start-mongo)
    (f)
    (stop-mongo)))

(defn fresh-db []
  (let [host (.getHost mongo-container)
        port (.getMappedPort mongo-container (int 27017))
        uri (str "mongodb://" host ":" port "/score-me-test")
        {:keys [db]} (mg/connect-via-uri uri)]
    ; Clear the collection before each test
    (mc/drop db "config")
    db))

(deftest create-config-handler-test
  (let [db (fresh-db)
        handler (system/create-config-handler db)
        valid-body {:name "Test Config"
                    :metrics [{:name "Metric1" :expectation "Do X"}]
                    :email "test@example.com"}
        invalid-body {:name "Test Config"
                      :metrics []
                      :email "test@example.com"}]

    (testing "Valid config creation"
      (let [request {:json-params valid-body}
            response (handler request)]
        (is (= 200 (:status response)))
        (is (= "application/json" (get-in response [:headers "Content-Type"])))
        (is (= {:result "saved" :message "Config created"}
               (json/parse-string (:body response) true)))
        ;; Check that the config is actually in the DB
        (is (= 1 (mc/count db "config" {:name "Test Config"})))))

    ;; In a real system, the validation would be handled by interceptors before the handler
    (testing "Validation using spec directly"
      (is (not (s/valid? :myscore.system/create-config-params invalid-body)))
      (is (s/valid? :myscore.system/create-config-params valid-body)))))

;; Test that mimics the actual request flow with interceptors
(deftest create-config-validation-test
  (let [db (fresh-db)
        validate-interceptor (system/validate-create-config)
        handler-interceptor {:enter (fn [context] 
                                      (assoc context :response 
                                             ((system/create-config-handler db) 
                                              (:request context))))}
        valid-body {:name "Test Config"
                    :metrics [{:name "Metric1" :expectation "Do X"}]
                    :email "test@example.com"}
        invalid-body {:name "Test Config"
                      :metrics []
                      :email "test@example.com"}]
    
    (testing "Valid request passes validation"
      (let [context {:request {:json-params valid-body}}
            context-after-validation ((:enter validate-interceptor) context)
            context-after-handler ((:enter handler-interceptor) context-after-validation)
            response (:response context-after-handler)]
        (is (nil? (:response context-after-validation))) ;; No early response = validation passed
        (is (= 200 (:status response)))))
    
    (testing "Invalid request fails validation"
      (let [context {:request {:json-params invalid-body}}
            context-after-validation ((:enter validate-interceptor) context)
            response-body (:body (:response context-after-validation))]
        (is (= 400 (get-in context-after-validation [:response :status])))
        (is (contains? response-body :error))))))

;; Test for the scorecard creation
(deftest create-scorecard-validation-test
  (let [db (fresh-db)
        validate-interceptor (system/validate-create-scorecard)
        handler-interceptor {:enter (fn [context] 
                                     (assoc context :response 
                                            ((system/create-scorecard-handler db) 
                                             (:request context))))}
        valid-body {:configName "Test Config"
                    :scores [{:metricName "Metric1"
                              :devScore 8.5
                              :mentorScore 9.0
                              :notes "Great work"}]
                    :email "test@example.com"
                    :dateCreated "2023-08-01T12:00:00Z"
                    :startDate "2023-07-01"
                    :endDate "2023-07-31"
                    :generalNotes "Overall excellent performance"}
        invalid-body {:configName "Test Config"
                     :scores []  ;; Empty scores array should fail validation
                     :email "test@example.com"
                     :dateCreated "2023-08-01T12:00:00Z"}]
    
    (testing "Valid scorecard request passes validation"
      (let [context {:request {:json-params valid-body}}
            context-after-validation ((:enter validate-interceptor) context)
            context-after-handler ((:enter handler-interceptor) context-after-validation)
            response (:response context-after-handler)]
        (is (nil? (:response context-after-validation))) ;; No early response = validation passed
        (is (= 200 (:status response)))))
    
    (testing "Invalid scorecard request fails validation"
      (let [context {:request {:json-params invalid-body}}
            context-after-validation ((:enter validate-interceptor) context)
            response-body (:body (:response context-after-validation))]
        (is (= 400 (get-in context-after-validation [:response :status])))
        (is (contains? response-body :error))))))