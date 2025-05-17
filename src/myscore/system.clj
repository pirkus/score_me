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
   [myscore.http-resp :as http-resp]
   [myscore.jwt :as jwt]
   [myscore.specs :as specs]
   [ring.util.response :as response]
   [clojure.tools.logging :as log]))

(def exception-handler
  (err/error-dispatch [context ex]
    [{:exception-type :com.fasterxml.jackson.core.io.JsonEOFException}]
    (assoc context :response (http-resp/handle-validation-error ex))

    [{:exception-type :com.mongodb.MongoException}]
    (assoc context :response (http-resp/handle-db-error ex))

    :else
    (assoc context :response (http-resp/server-error (str ex)))))

;; ----------------------------------------------------------------------------
;; Mongo Component
;; ----------------------------------------------------------------------------

(defrecord MongoComponent [uri conn db]
  component/Lifecycle
  (start [this]
    (let [{:keys [conn db]} (mg/connect-via-uri uri)]
      (mc/ensure-index db "config" (array-map :email 1 :name 1) {:unique true})
      ;; Index for faster scorecard queries by email
      (mc/ensure-index db "scorecards" (array-map :email 1) {:name "scorecards_email_idx"})
      (assoc this :conn conn :db db)))
  (stop [this]
    (when conn (mg/disconnect conn))
    (assoc this :conn nil :db nil)))

;; ----------------------------------------------------------------------------
;; Validation Interceptor
;; ----------------------------------------------------------------------------

(defn validate-create-config []
  (interceptor/interceptor
   {:name ::validate-create-config
    :enter (fn [context]
             (let [params (get-in context [:request :json-params])]
               (if (s/valid? ::specs/create-config-params params)
                 context
                 (assoc context :response
                        (-> (response/response {:error "Invalid config parameters"
                                                :details (s/explain-data ::specs/create-config-params params)})
                            (response/status 400))))))}))

(defn validate-create-scorecard []
  (interceptor/interceptor
   {:name ::validate-create-scorecard
    :enter (fn [context]
             (let [params (get-in context [:request :json-params])]
               (if (s/valid? ::specs/create-scorecard-params params)
                 context
                 (assoc context :response
                        (-> (response/response {:error "Invalid scorecard parameters"
                                                :details (s/explain-data ::specs/create-scorecard-params params)})
                            (response/status 400))))))}))

;; ----------------------------------------------------------------------------
;; HTTP Component
;; ----------------------------------------------------------------------------

(defn create-config-handler [db]
  (fn [request]
    (try
      (let [{:keys [name metrics email]} (:json-params request)
            result (db/save-config db name metrics email)]
        (if (contains? result :result)
          (http-resp/ok {:result "saved" :message "Config created"})
          (http-resp/bad-request (:error result))))
      (catch Exception e
        (http-resp/handle-db-error e)))))

(defn get-configs-handler [db]
  (fn [request]
    (try
      (let [docs (mc/find-maps db "config" {:email (get-in request [:identity :email])})]
        (http-resp/ok (->> docs (map #(dissoc % :_id)))))
      (catch Exception e
        (http-resp/handle-db-error e)))))

(defn get-scorecards-handler [db]
  (fn [request]
    (try
      (let [docs (mc/find-maps db "scorecards" 
                              {:email (get-in request [:identity :email])
                               :archived {:$ne true}})]
        (http-resp/ok (->> docs 
                          (map #(-> % 
                                   (assoc :id (str (:_id %))) 
                                   (dissoc :_id))))))
      (catch Exception e
        (http-resp/handle-db-error e)))))

;; Helper function to find existing overlapping scorecards
(defn find-overlapping-scorecard
  "Find any scorecard for the same user that overlaps with the given date range"
  [db email start-date end-date]
  (mc/find-one-as-map db "scorecards" 
                      {:email email
                       :$or [{:startDate {:$lte end-date}
                              :endDate {:$gte start-date}}]}))

(defn create-scorecard-handler [db]
  (fn [request]
    (try
      (let [scorecard-data (:json-params request)
            email (:email scorecard-data)
            start-date (:startDate scorecard-data)
            end-date (:endDate scorecard-data)
            existing (find-overlapping-scorecard db email start-date end-date)]
        
        (if existing
          (http-resp/bad-request 
           (str "This time period overlaps with an existing scorecard. "
                "You already have a scorecard for " 
                (:startDate existing) " to " 
                (:endDate existing) "."))
          
          (let [id (mu/object-id)
                document (assoc scorecard-data :_id id)]
            (try
              (mc/insert db "scorecards" document)
              (http-resp/ok {:result "saved" :id (str id)})
              (catch Exception e
                (http-resp/handle-db-error e))))))
      (catch Exception e
        (http-resp/handle-validation-error e)))))

(defn get-scorecard-handler [db]
  (fn [request]
    (let [id (get-in request [:path-params :id])]
      (if-let [id-error (http-resp/handle-id-error id)]
        id-error
        (try
          (let [doc (mc/find-map-by-id db "scorecards" (mu/object-id id))]
            (if doc
              (http-resp/ok (-> doc (assoc :id (str (:_id doc))) (dissoc :_id)))
              (http-resp/not-found "Scorecard not found")))
          (catch Exception e
            (http-resp/handle-db-error e)))))))

(defn archive-scorecard-handler [db]
  (fn [request]
    (let [id (get-in request [:path-params :id])]
      (if-let [id-error (http-resp/handle-id-error id)]
        id-error
        (try
          (let [oid (mu/object-id id)
                result (mc/update-by-id db "scorecards" oid {:$set {:archived true}})
                n (.getN result)]
            (if (pos? n)
              (http-resp/ok {:result "archived" :id id})
              (http-resp/not-found "Scorecard not found")))
          (catch Exception e
            (http-resp/handle-db-error e)))))))

(defn health-handler []
  (fn [_]
    {:status 200
     :body   "OK"}))

(defn make-routes [db]
  (route/expand-routes
   #{["/scoreboard-config" :post
      [jwt/auth-interceptor exception-handler (body-params) (validate-create-config) (create-config-handler db)]
      :route-name :config-create]

     ["/scoreboard-configs" :get
      [jwt/auth-interceptor exception-handler (get-configs-handler db)]
      :route-name :config-get]
      
     ["/create-scoreboard" :post
      [jwt/auth-interceptor exception-handler (body-params) (validate-create-scorecard) (create-scorecard-handler db)]
      :route-name :scorecard-create]

     ["/scorecards" :get
      [jwt/auth-interceptor exception-handler (get-scorecards-handler db)]
      :route-name :scorecards-get]

     ["/scorecards/:id" :get
      [jwt/auth-interceptor exception-handler (get-scorecard-handler db)]
      :route-name :scorecard-get]

     ["/scorecards/:id/archive" :post
      [jwt/auth-interceptor exception-handler (archive-scorecard-handler db)]
      :route-name :scorecards-archive]

     ["/health" :get
      [(health-handler)]
      :route-name :health]}))

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
