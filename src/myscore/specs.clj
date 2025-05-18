(ns myscore.specs
  (:require [clojure.spec.alpha :as s]))

;; Config specs
(s/def ::name string?)
(s/def ::expectation string?)
(s/def ::scoreType #{"numeric" "checkbox"})
(s/def ::metric (s/keys :req-un [::name ::expectation ::scoreType]))
(s/def ::metrics (s/coll-of ::metric :min-count 1))
(s/def ::email string?)
(s/def ::create-config-params (s/keys :req-un [::name ::metrics ::email]))

;; Metric spec for scorecards
(s/def ::metricName string?)
;; More specific numeric score validation
(s/def ::numeric-score (s/and number? #(<= 0 % 10)))
;; Boolean validation for checkbox
(s/def ::checkbox-score boolean?)
(s/def ::devScore (s/or :numeric ::numeric-score :checkbox ::checkbox-score))
(s/def ::mentorScore (s/or :numeric ::numeric-score :checkbox ::checkbox-score))
(s/def ::notes (s/nilable string?))
(s/def ::score (s/keys :req-un [::metricName ::devScore ::mentorScore] :opt-un [::notes]))

;; Scorecard specs
(s/def ::scores (s/coll-of ::score :min-count 1))
(s/def ::configName string?)
(s/def ::generalNotes (s/nilable string?))
(s/def ::dateCreated string?)
(s/def ::startDate string?)
(s/def ::endDate string?)
(s/def ::archived boolean?)
(s/def ::_id (s/nilable string?))
(s/def ::create-scorecard-params (s/keys :req-un [::configName ::email ::scores ::dateCreated ::startDate ::endDate] 
                                       :opt-un [::generalNotes ::archived ::_id]))