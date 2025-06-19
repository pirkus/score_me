(ns pebbles.progress-handler-test
  (:require
   [clojure.test :refer [deftest is testing use-fixtures]]
   [pebbles.system :as system]
   [pebbles.test-utils :as test-utils]
   [pebbles.db :as db]
   [monger.collection :as mc]))

(def test-db (atom nil))

(defn db-fixture [f]
  (let [db (test-utils/fresh-db)]
    (reset! test-db db)
    (try
      (f)
      (finally
        (test-utils/cleanup-db db)))))

(use-fixtures :each db-fixture)

(deftest update-progress-handler-test
  (let [handler (system/update-progress-handler @test-db)
        email "test@example.com"
        identity {:email email}]
    
    (testing "Create new progress"
      (let [request (test-utils/make-test-request
                     {:filename "test-file.csv"
                      :counts {:done 10 :warn 2 :failed 1}
                      :total 100}
                     :identity identity)
            response (handler request)
            body (test-utils/parse-json-response response)]
        (is (= 200 (:status response)))
        (is (= "created" (:result body)))
        (is (= "test-file.csv" (:filename body)))
        (is (= {:done 10 :warn 2 :failed 1} (:counts body)))
        (is (= 100 (:total body)))
        (is (false? (:isCompleted body)))
        
        ;; Verify in database
        (let [saved (db/find-progress @test-db "test-file.csv" email)]
          (is (= "test-file.csv" (:filename saved)))
          (is (= email (:email saved)))
          (is (= {:done 10 :warn 2 :failed 1} (:counts saved)))
          (is (= 100 (:total saved)))
          (is (false? (:isCompleted saved))))))
    
    (testing "Update existing progress"
      (let [;; First create a progress
            _ (handler (test-utils/make-test-request
                       {:filename "update-test.csv"
                        :counts {:done 5 :warn 0 :failed 0}}
                       :identity identity))
            ;; Then update it
            update-request (test-utils/make-test-request
                           {:filename "update-test.csv"
                            :counts {:done 10 :warn 1 :failed 0}}
                           :identity identity)
            response (handler update-request)
            body (test-utils/parse-json-response response)]
        (is (= 200 (:status response)))
        (is (= "updated" (:result body)))
        (is (= {:done 15 :warn 1 :failed 0} (:counts body)))
        
        ;; Verify counts were added, not replaced
        (let [saved (db/find-progress @test-db "update-test.csv" email)]
          (is (= {:done 15 :warn 1 :failed 0} (:counts saved))))))
    
    (testing "Complete progress with isLast flag"
      (let [request (test-utils/make-test-request
                     {:filename "complete-test.csv"
                      :counts {:done 100 :warn 0 :failed 0}
                      :total 100
                      :isLast true}
                     :identity identity)
            response (handler request)
            body (test-utils/parse-json-response response)]
        (is (= 200 (:status response)))
        (is (true? (:isCompleted body)))
        
        ;; Verify in database
        (let [saved (db/find-progress @test-db "complete-test.csv" email)]
          (is (true? (:isCompleted saved))))))
    
    (testing "Reject update to completed progress"
      (let [;; First create and complete a progress
            _ (handler (test-utils/make-test-request
                       {:filename "locked-test.csv"
                        :counts {:done 100 :warn 0 :failed 0}
                        :isLast true}
                       :identity identity))
            ;; Try to update it
            update-request (test-utils/make-test-request
                           {:filename "locked-test.csv"
                            :counts {:done 10 :warn 0 :failed 0}}
                           :identity identity)
            response (handler update-request)
            body (test-utils/parse-json-response response)]
        (is (= 400 (:status response)))
        (is (= "This file processing has already been completed" (:error body)))))
    
    (testing "Missing email in identity"
      (let [request (test-utils/make-test-request
                     {:filename "no-auth.csv"
                      :counts {:done 1 :warn 0 :failed 0}}
                     :identity {})
            response (handler request)
            body (test-utils/parse-json-response response)]
        (is (= 403 (:status response)))
        (is (= "No email found in authentication token" (:error body)))))
    
    (testing "Add total to existing progress"
      (let [;; Create without total
            _ (handler (test-utils/make-test-request
                       {:filename "add-total.csv"
                        :counts {:done 5 :warn 0 :failed 0}}
                       :identity identity))
            ;; Update with total
            update-request (test-utils/make-test-request
                           {:filename "add-total.csv"
                            :counts {:done 5 :warn 0 :failed 0}
                            :total 200}
                           :identity identity)
            response (handler update-request)
            body (test-utils/parse-json-response response)]
        (is (= 200 (:status response)))
        (is (= 200 (:total body)))
        
        ;; Verify total was added
        (let [saved (db/find-progress @test-db "add-total.csv" email)]
          (is (= 200 (:total saved))))))))

(deftest get-progress-handler-test
  (let [update-handler (system/update-progress-handler @test-db)
        get-handler (system/get-progress-handler @test-db)
        email "test@example.com"
        identity {:email email}]
    
    ;; Setup: Create some progress records
    (update-handler (test-utils/make-test-request
                    {:filename "file1.csv"
                     :counts {:done 50 :warn 5 :failed 2}
                     :total 100}
                    :identity identity))
    (update-handler (test-utils/make-test-request
                    {:filename "file2.csv"
                     :counts {:done 30 :warn 0 :failed 0}
                     :total 50}
                    :identity identity))
    
    (testing "Get specific file progress"
      (let [request {:identity identity
                     :query-params {:filename "file1.csv"}}
            response (get-handler request)
            body (test-utils/parse-json-response response)]
        (is (= 200 (:status response)))
        (is (= "file1.csv" (:filename body)))
        (is (= {:done 50 :warn 5 :failed 2} (:counts body)))
        (is (= 100 (:total body)))
        (is (contains? body :id))))
    
    (testing "Get all progress for user"
      (let [request {:identity identity
                     :query-params {}}
            response (get-handler request)
            body (test-utils/parse-json-response response)]
        (is (= 200 (:status response)))
        (is (= 2 (count body)))
        (is (every? #(contains? % :id) body))
        (is (every? #(= email (:email %)) body))))
    
    (testing "Progress not found for filename"
      (let [request {:identity identity
                     :query-params {:filename "nonexistent.csv"}}
            response (get-handler request)
            body (test-utils/parse-json-response response)]
        (is (= 404 (:status response)))
        (is (= "Progress not found for this file" (:error body)))))
    
    (testing "Missing email in identity"
      (let [request {:identity {}
                     :query-params {:filename "file1.csv"}}
            response (get-handler request)
            body (test-utils/parse-json-response response)]
        (is (= 403 (:status response)))
        (is (= "No email found in authentication token" (:error body)))))
    
    (testing "User can only see their own progress"
      (let [other-email "other@example.com"
            other-identity {:email other-email}
            ;; Create progress for other user
            _ (update-handler (test-utils/make-test-request
                              {:filename "other-file.csv"
                               :counts {:done 10 :warn 0 :failed 0}}
                              :identity other-identity))
            ;; Try to access with original user
            request {:identity identity
                     :query-params {:filename "other-file.csv"}}
            response (get-handler request)
            body (test-utils/parse-json-response response)]
        (is (= 404 (:status response)))))))