(ns myscore.specs
  (:require [clojure.spec.alpha :as s]))

;; Config specs
(s/def ::name string?)
(s/def ::expectation string?)
(s/def ::metric (s/keys :req-un [::name ::expectation]))
(s/def ::metrics (s/coll-of ::metric :min-count 1))
(s/def ::email string?)
(s/def ::create-config-params (s/keys :req-un [::name ::metrics ::email]))

;; Scorecard specs
(s/def ::metricName string?)
(s/def ::devScore (s/and number? #(<= 0 % 10)))
(s/def ::mentorScore (s/and number? #(<= 0 % 10)))
(s/def ::notes string?)
(s/def ::score (s/keys :req-un [::metricName ::devScore ::mentorScore] :opt-un [::notes]))
(s/def ::scores (s/coll-of ::score :min-count 1))
(s/def ::configName string?)
(s/def ::generalNotes string?)
(s/def ::dateCreated string?)
(s/def ::startDate string?)
(s/def ::endDate string?)
(s/def ::archived boolean?)
(s/def ::create-scorecard-params (s/keys :req-un [::configName ::email ::scores ::dateCreated ::startDate ::endDate] 
                                       :opt-un [::generalNotes ::archived]))