(ns myscore.http-resp-test
  (:require [clojure.test :refer [deftest testing is]]
            [myscore.http-resp :as http-resp]
            [cheshire.core :as json]
            [monger.util :as mu]))

(deftest json-response-test
  (testing "Basic JSON response structure"
    (let [response (http-resp/json 200 {:message "test"})]
      (is (= 200 (:status response)))
      (is (= "application/json" (get-in response [:headers "Content-Type"])))
      (is (string? (:body response)))
      (is (= "{\"message\":\"test\"}" (:body response))))))

(deftest ok-response-test
  (testing "OK response with various body types"
    (let [response (http-resp/ok {:message "test"})]
      (is (= 200 (:status response)))
      (is (= "{\"message\":\"test\"}" (:body response))))
    
    (let [response (http-resp/ok [1 2 3])]
      (is (= 200 (:status response)))
      (is (= "[1,2,3]" (:body response))))))

(deftest error-response-test
  (testing "Bad request response"
    (let [response (http-resp/bad-request "Invalid input")]
      (is (= 400 (:status response)))
      (is (= "{\"error\":\"Invalid input\"}" (:body response)))))
  
  (testing "Not found response"
    (let [response (http-resp/not-found "Resource not found")]
      (is (= 404 (:status response)))
      (is (= "{\"error\":\"Resource not found\"}" (:body response)))))
  
  (testing "Server error response"
    (let [response (http-resp/server-error "Internal error")]
      (is (= 500 (:status response)))
      (is (= "{\"error\":\"Internal error\"}" (:body response))))))

(deftest handle-db-error-test
  (testing "Duplicate key error"
    (let [ex (ex-info "Duplicate key error" {:type :com.mongodb.MongoException$DuplicateKey})
          response (http-resp/handle-db-error ex)]
      (is (= 400 (:status response)))
      (is (= "{\"error\":\"A record with this identifier already exists\"}" (:body response)))))
  
  (testing "Network error"
    (let [ex (ex-info "Network error" {:type :com.mongodb.MongoException$Network})
          response (http-resp/handle-db-error ex)]
      (is (= 500 (:status response)))
      (is (= "{\"error\":\"Database connection error\"}" (:body response)))))
  
  (testing "Timeout error"
    (let [ex (ex-info "Timeout error" {:type :com.mongodb.MongoException$Timeout})
          response (http-resp/handle-db-error ex)]
      (is (= 500 (:status response)))
      (is (= "{\"error\":\"Database operation timed out\"}" (:body response)))))
  
  (testing "Generic database error"
    (let [ex (ex-info "Generic error" {:type :com.mongodb.MongoException})
          response (http-resp/handle-db-error ex)]
      (is (= 500 (:status response)))
      (is (= "{\"error\":\"Database error: Generic error\"}" (:body response))))))

(deftest handle-id-error-test
  (testing "Valid ObjectId"
    (is (nil? (http-resp/handle-id-error (str (mu/object-id))))))
  
  (testing "Invalid ObjectId"
    (let [response (http-resp/handle-id-error "invalid-id")]
      (is (= 400 (:status response)))
      (is (= "{\"error\":\"Invalid ID format\"}" (:body response))))))

(deftest handle-validation-error-test
  (testing "JSON parsing error"
    (let [ex (ex-info "Invalid JSON" {:type :com.fasterxml.jackson.core.io.JsonEOFException})
          response (http-resp/handle-validation-error ex)]
      (is (= 400 (:status response)))
      (is (= "{\"error\":\"Invalid JSON format\"}" (:body response)))))
  
  (testing "Clojure spec validation error"
    (let [ex (ex-info "Validation failed" {:type :clojure.lang.ExceptionInfo})
          response (http-resp/handle-validation-error ex)]
      (is (= 400 (:status response)))
      (is (= "{\"error\":\"Validation error: Validation failed\"}" (:body response)))))
  
  (testing "Generic validation error"
    (let [ex (ex-info "Invalid input" {:type :java.lang.IllegalArgumentException})
          response (http-resp/handle-validation-error ex)]
      (is (= 400 (:status response)))
      (is (= "{\"error\":\"Invalid input: Invalid input\"}" (:body response))))))