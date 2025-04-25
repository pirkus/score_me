(ns myscore.system
  (:require
    [com.stuartsierra.component :as component]
    [io.pedestal.http :as http]
    [io.pedestal.http.body-params :refer [body-params]]
    [io.pedestal.http.route :as route]
    [monger.core :as mg]
    [monger.collection :as mc]
    [monger.util :as mu]
    [ring.util.response :as response]))

;; ----------------------------------------------------------------------------
;; Mongo Component
;; ----------------------------------------------------------------------------

(defrecord MongoComponent [uri db-name conn db]
  component/Lifecycle
  (start [this]
    (let [conn (mg/connect uri)
          db   (mg/get-db conn db-name)]
      (assoc this :conn conn :db db)))
  (stop [this]
    (when conn (mg/disconnect conn))
    (assoc this :conn nil :db nil)))

;; ----------------------------------------------------------------------------
;; HTTP Component
;; ----------------------------------------------------------------------------

(defn create-scoreboard-handler [db]
  (fn [request]
    (let [{:keys [name metrics]} (:json-params request)
          inserted (mc/insert-and-return db "scoreboards"
                     {:name name :metrics metrics})]
      (-> (response/response
            {:id (str (:_id inserted))
             :message "Scoreboard created"})
          (response/status 201)))))

(defn get-scoreboard-handler [db]
  (fn [request]
    (let [id-str (get-in request [:path-params :id])]
      (try
        (let [object-id (mu/object-id id-str)
              doc (mc/find-map-by-id db "scoreboards" object-id)]
          (if doc
            (response/response doc)
            (-> (response/response {:error "Scoreboard not found"})
                (response/status 404))))
        (catch Exception _
          (-> (response/response {:error "Invalid ID format"})
              (response/status 400)))))))

(defn make-routes [db]
  (route/expand-routes
    #{["/scoreboards" :post
       [(body-params) http/json-body (create-scoreboard-handler db)]
       :route-name :scoreboards-create]

      ["/scoreboards/:id" :get
       [(get-scoreboard-handler db)]
       :route-name :scoreboards-get]}))

(defn make-server [port routes]
  (-> {::http/routes routes
       ::http/type   :jetty
       ::http/host   "0.0.0.0"
       ::http/port   port}
      http/default-interceptors
      http/dev-interceptors
      http/create-server))

(defrecord HttpComponent [port mongo server]
  component/Lifecycle
  (start [this]
    (if server
      this
      (let [db (:db mongo)
            srv (make-server port (make-routes db))]
        (assoc this :server (http/start srv)))))
  (stop [this]
    (when server (http/stop server))
    (assoc this :server nil)))

;; ----------------------------------------------------------------------------
;; System assembly
;; ----------------------------------------------------------------------------

(defn system []
  (component/system-map
    :mongo (map->MongoComponent {:uri     (or (System/getenv "MONGO_URI") "mongodb://localhost:27017")
                                 :db-name "scoreboard"})
    :http  (component/using
             (map->HttpComponent {:port (Integer/parseInt (or (System/getenv "PORT") "8080"))})
             [:mongo])))

(defn -main [& _]
  (component/start (system)))
