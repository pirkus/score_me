(ns myscore.handlers.handler-test
  (:require
    [clojure.test :refer [deftest is testing use-fixtures]]
    [cheshire.core :as json]
    [myscore.system :as system]
    [myscore.specs :as specs]
    [clojure.spec.alpha :as s]
    [monger.core :as mg]
    [monger.collection :as mc])
  (:import
    [org.testcontainers.containers MongoDBContainer]
    [org.testcontainers.utility DockerImageName]))

(def ^:private mongo-container
  (doto (MongoDBContainer. (DockerImageName/parse "mongo:latest"))
    (.withExposedPorts (into-array Integer [(int 27017)]))
    (.start)))

;; Make sure the container is started before tests run
(defonce ensure-mongo-started
  (do
    (when-not (.isRunning mongo-container)
      (.start mongo-container))
    true))

(use-fixtures
  :once
  (fn [f]
    ;; Container is already started by the init code above
    (f)))

(defn fresh-db []
  (let [host (.getHost mongo-container)
        port (.getMappedPort mongo-container (int 27017))
        uri (str "mongodb://" host ":" port "/score-me-test")
        {:keys [db]} (mg/connect-via-uri uri)]
    ;; Clear the collections before each test
    (mc/drop db "config")
    (mc/drop db "scorecards")
    db))

;; Add remaining tests from the original handler_test.clj file here 