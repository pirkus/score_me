(ns myscore.utils-test
  (:require
    [clojure.test :refer [deftest is testing]]
    [myscore.system :as system]
    [monger.util :as mu]))

(deftest encode-decode-id-test
  (testing "encoding and decoding ObjectId"
    (let [id (mu/object-id)
          id-str (str id)
          encoded (system/encode-id id-str)
          decoded (system/decode-id encoded)]
      (is (string? encoded))
      (is (not= id-str encoded))
      (is (= id-str decoded))))
  
  (testing "encoding and decoding string ID"
    (let [id-str "507f1f77bcf86cd799439011"
          encoded (system/encode-id id-str)
          decoded (system/decode-id encoded)]
      (is (string? encoded))
      (is (not= id-str encoded))
      (is (= id-str decoded))))
  
  (testing "decoding invalid base64"
    (is (nil? (system/decode-id "!invalid-base64!"))))) 