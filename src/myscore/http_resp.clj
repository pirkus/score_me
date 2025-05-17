(ns myscore.http-resp
  (:require [cheshire.core :as json]))

(defn json [status body]
  {:status status
   :body (json/generate-string body)
   :headers {"Content-Type" "application/json"}})

(defn ok [body]
  (json 200 body))

(defn bad-request [error-msg]
  (json 400 {:error error-msg}))

(defn not-found [error-msg]
  (json 404 {:error error-msg}))

(defn server-error [error-msg]
  (json 500 {:error error-msg}))

;; Error handling helpers
(defn handle-db-error [e]
  (let [data (ex-data e)
        type-key (:type data)]
    (cond
      (= type-key :com.mongodb.MongoException$DuplicateKey)
      (bad-request "A record with this identifier already exists")
      
      (= type-key :com.mongodb.MongoException$Network)
      (server-error "Database connection error")
      
      (= type-key :com.mongodb.MongoException$Timeout)
      (server-error "Database operation timed out")
      
      :else
      (server-error (str "Database error: " (.getMessage e))))))

(defn handle-id-error [id]
  (try
    (monger.util/object-id id)
    nil
    (catch Exception _
      (bad-request "Invalid ID format"))))

(defn handle-validation-error [e]
  (let [data (ex-data e)
        type-key (:type data)]
    (cond
      (= type-key :com.fasterxml.jackson.core.io.JsonEOFException)
      (bad-request "Invalid JSON format")
      
      (= type-key :clojure.lang.ExceptionInfo)
      (bad-request (str "Validation error: " (.getMessage e)))
      
      :else
      (bad-request (str "Invalid input: " (.getMessage e))))))