(ns myscore.system
  (:require
   [cheshire.core :as json]
   [clojure.spec.alpha :as s]
   [com.stuartsierra.component :as component]
   [io.pedestal.http :as http]
   [io.pedestal.http.body-params :refer [body-params]]
   [io.pedestal.http.route :as route]
   [io.pedestal.interceptor :as interceptor]
   [io.pedestal.interceptor.error :as err]
   [monger.collection :as mc]
   [monger.core :as mg]
   [monger.util :as mu]
   [myscore.db :as db]
   [myscore.jwt :as jwt]
   [ring.util.response :as response]))

(def exception-handler
  (err/error-dispatch [context ex]

                      [{:exception-type :com.fasterxml.jackson.core.io.JsonEOFException}]
                      (assoc context :response {:status 400 :body {:error "Invalid JSON"}})

                      :else
                      (assoc context :response {:status 500 :body (str ex)})))

;; ----------------------------------------------------------------------------
;; Mongo Component
;; ----------------------------------------------------------------------------

(defrecord MongoComponent [uri conn db]
  component/Lifecycle
  (start [this]
    (let [{:keys [conn db]} (mg/connect-via-uri uri)]
      (mc/ensure-index db "config" (array-map :email 1 :name 1) {:unique true})
      (assoc this :conn conn :db db)))
  (stop [this]
    (when conn (mg/disconnect conn))
    (assoc this :conn nil :db nil)))

;; ----------------------------------------------------------------------------
;; Data Specs
;; ----------------------------------------------------------------------------

(s/def ::name string?)
(s/def ::expectation string?)
(s/def ::metric (s/keys :req-un [::name ::expectation]))
(s/def ::metrics (s/coll-of ::metric :min-count 1))
(s/def ::email string?)
(s/def ::create-config-params (s/keys :req-un [::name ::metrics ::email]))

;; ----------------------------------------------------------------------------
;; Validation Interceptor
;; ----------------------------------------------------------------------------

(defn validate-create-config []
  (interceptor/interceptor
   {:name ::validate-create-config
    :enter (fn [context]
             (let [params (get-in context [:request :json-params])]
               (if (s/valid? ::create-config-params params)
                 context
                 (assoc context :response
                        (-> (response/response {:error "Invalid config parameters"
                                                :details (s/explain-data ::create-config-params params)})
                            (response/status 400))))))}))

;; ----------------------------------------------------------------------------
;; HTTP Component
;; ----------------------------------------------------------------------------

(defn create-config-handler [db]
  (fn [request]
    (let [{:keys [name metrics email]} (:json-params request)
          result (db/save-config db name metrics email)]
      (if (contains? result :result)
        {:status  200
         :body    (json/generate-string {:result "saved" :message "Config created"})
         :headers {"Content-Type" "application/json"}}
        {:status  400
         :body    (json/generate-string {:error (:error result)})
         :headers {"Content-Type" "application/json"}}))))

(defn get-config-handler [db]
  (fn [request]
    (let [id-str    (get-in request [:path-params :id])
          object-id (mu/object-id id-str)
          doc       (mc/find-map-by-id db "config" object-id)]
      (if doc
        (response/response doc)
        (-> (response/response {:error "Config not found"})
            (response/status 404))))))

(defn make-routes [db]
  (route/expand-routes
   #{["/scoreboard-config" :post
      [jwt/auth-interceptor exception-handler (body-params) (validate-create-config) (create-config-handler db)]
      :route-name :config-create]

     ["/scoreboard-configs" :get
      [(get-config-handler db)]
      :route-name :config-get]}))

(defn make-server [port routes]
  (-> {::http/routes routes
       ::http/type   :jetty
       ::http/host   "0.0.0.0"
       ::http/port   port
       ::http/allowed-origins {:creds true :allowed-origins (constantly true)}}
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
   :mongo (map->MongoComponent {:uri     (or (System/getenv "MONGO_URI") "mongodb://localhost:27017/score-me")})
   :http  (component/using
           (map->HttpComponent {:port (Integer/parseInt (or (System/getenv "PORT") "8080"))})
           [:mongo])))

(defn -main [& _]
  (component/start (system)))
