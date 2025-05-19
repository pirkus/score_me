(ns myscore.handlers.date-test
  (:require
    [clojure.test :refer [deftest is testing]]
    [myscore.system :refer [valid-date? find-overlapping-scorecard]]
    [monger.collection :as mc]
    [monger.util :as mu]
    [myscore.handlers.handler-test :refer [fresh-db]]))

(deftest date-format-test
  (testing "valid date formats"
    (is (true? (valid-date? "2023-01-01")))
    (is (true? (valid-date? "2023-12-31")))
    (is (true? (valid-date? "2000-02-29")))
    (is (true? (valid-date? "01-01-2023")))  ;; System accepts MM-DD-YYYY
    (is (true? (valid-date? "2023-1-1"))))   ;; System accepts single digits
  
  (testing "invalid date formats"
    (is (nil? (valid-date? nil)))            ;; Should return nil, not false
    (is (false? (valid-date? "")))           
    (is (false? (valid-date? "2023/01/01"))) ;; Wrong separator
    (is (false? (valid-date? "not-a-date"))) ;; Not date-like
    (is (nil? (valid-date? 20230101)))       ;; Should return nil for non-string
    (is (nil? (valid-date? {:year 2023 :month 1 :day 1})))))  ;; Should return nil for non-string

(deftest date-overlapping-test
  (let [db (fresh-db)
        email "test@example.com"
        configA "configA"
        configB "configB"
        start-date "2023-01-01"
        end-date "2023-01-10"]

    ;; Clean up before
    (mc/remove db "scorecards" {:email email})

    (testing "overlap with same configName is found"
      (let [overlap {:email email :configName configA :startDate "2023-01-05" :endDate "2023-01-15"}]
        (mc/insert db "scorecards" overlap)
        (let [result (find-overlapping-scorecard db email configA start-date end-date)]
          (is (not (nil? result)))
          (is (= (:configName result) configA)))
        (mc/remove db "scorecards" {:email email :configName configA})))

    (testing "overlap with different configName is not found"
      (let [overlap {:email email :configName configB :startDate "2023-01-05" :endDate "2023-01-15"}]
        (mc/insert db "scorecards" overlap)
        (let [result (find-overlapping-scorecard db email configA start-date end-date)]
          (is (nil? result)))
        (mc/remove db "scorecards" {:email email :configName configB})))

    (testing "no overlap returns nil"
      (let [non-overlap {:email email :configName configA :startDate "2023-02-01" :endDate "2023-02-10"}]
        (mc/insert db "scorecards" non-overlap)
        (let [result (find-overlapping-scorecard db email configA start-date end-date)]
          (is (nil? result)))
        (mc/remove db "scorecards" {:email email :configName configA})))

    (testing "multiple overlaps returns at least one"
      (let [overlap1 {:email email :configName configA :startDate "2023-01-05" :endDate "2023-01-15"}
            overlap2 {:email email :configName configA :startDate "2023-01-08" :endDate "2023-01-20"}]
        (mc/insert-batch db "scorecards" [overlap1 overlap2])
        (let [result (find-overlapping-scorecard db email configA start-date end-date)]
          (is (not (nil? result)))
          (is (= (:configName result) configA)))
        (mc/remove db "scorecards" {:email email :configName configA})))

    (testing "edge case: end date of one is start date of another (should overlap)"
      (let [edge {:email email :configName configA :startDate "2023-01-10" :endDate "2023-01-20"}]
        (mc/insert db "scorecards" edge)
        (let [result (find-overlapping-scorecard db email configA start-date end-date)]
          (is (not (nil? result))))
        (mc/remove db "scorecards" {:email email :configName configA})))
    
    (testing "archived scorecard should not be considered as overlapping"
      (let [archived {:email email 
                     :configName configA 
                     :startDate "2023-01-05" 
                     :endDate "2023-01-15"
                     :archived true}]
        (mc/insert db "scorecards" archived)
        (let [result (find-overlapping-scorecard db email configA start-date end-date)]
          (is (nil? result)))
        (mc/remove db "scorecards" {:email email :configName configA})))

    ;; Clean up after
    (mc/remove db "scorecards" {:email email})))

(deftest complex-overlap-test
  (let [db (fresh-db)
        email "test@example.com"
        config-name "Test Config"
        
        ;; Define test data - three scorecards:
        ;; 1. Normal scorecard (Jan 1-10)
        ;; 2. Overlapping archived scorecard (Jan 5-15) - should be ignored
        ;; 3. Overlapping active scorecard (Jan 15-25)
        
        scorecard1 {:_id (mu/object-id)
                    :email email
                    :configName config-name
                    :startDate "2023-01-01"
                    :endDate "2023-01-10"
                    :scores []}
        
        scorecard2 {:_id (mu/object-id)
                    :email email
                    :configName config-name
                    :startDate "2023-01-05"
                    :endDate "2023-01-15"
                    :archived true
                    :scores []}
        
        scorecard3 {:_id (mu/object-id)
                    :email email
                    :configName config-name
                    :startDate "2023-01-15"
                    :endDate "2023-01-25"
                    :scores []}]
    
    ;; Clear collection and insert test data
    (mc/drop db "scorecards")
    (mc/insert-batch db "scorecards" [scorecard1 scorecard2 scorecard3])
    
    (testing "Finding overlap with period that overlaps with archived card only"
      (let [result (find-overlapping-scorecard 
                      db email config-name "2023-01-11" "2023-01-14")]
        ;; Should return nil as the only overlapping card is archived
        (is (nil? result))))
    
    (testing "Finding overlap with period that overlaps with active card"
      (let [result (find-overlapping-scorecard 
                      db email config-name "2023-01-11" "2023-01-16")]
        ;; Should find scorecard3
        (is (= (str (:_id scorecard3)) (str (:_id result))))))
    
    (testing "Finding overlap with original card"
      (let [result (find-overlapping-scorecard 
                      db email config-name "2023-01-01" "2023-01-05")]
        ;; Should find scorecard1
        (is (= (str (:_id scorecard1)) (str (:_id result))))))
    
    ;; Clean up
    (mc/drop db "scorecards")))