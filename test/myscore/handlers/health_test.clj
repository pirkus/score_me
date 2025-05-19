(ns myscore.handlers.health-test
  (:require
    [clojure.test :refer [deftest is testing]]
    [myscore.system :as system]))

(deftest health-handler-test
  (testing "health endpoint returns 200 OK"
    (let [handler (system/health-handler)
          response (handler {})]
      (is (= 200 (:status response)))
      (is (= "OK" (:body response))))))