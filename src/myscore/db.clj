(ns myscore.db
  (:require
   [monger.collection :as mc]))

(defn save-config
  [db name metrics email]
  (try
    {:result (mc/insert-and-return db
                                   "config"
                                   {:name name :metrics metrics :email email})}
    (catch com.mongodb.DuplicateKeyException e
      {:error  (str "Config with name " name " already exists.")
       :ex     e})
    (catch Throwable t
      {:error "Unknown error."
       :ex    t})))
