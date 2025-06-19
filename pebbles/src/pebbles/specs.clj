(ns pebbles.specs
  (:require [clojure.spec.alpha :as s]))

;; Common specs
(s/def ::filename string?)
(s/def ::email string?)

;; Count specs
(s/def ::done (s/and integer? #(>= % 0)))
(s/def ::warn (s/and integer? #(>= % 0)))
(s/def ::failed (s/and integer? #(>= % 0)))
(s/def ::counts (s/keys :req-un [::done ::warn ::failed]))

;; Progress update specs
(s/def ::total (s/nilable (s/and integer? #(> % 0))))
(s/def ::isLast boolean?)

;; Main request spec for progress update
(s/def ::progress-update-params (s/keys :req-un [::filename ::counts]
                                       :opt-un [::total ::isLast]))