(ns myscore.system
  (:require
   [clojure.spec.alpha :as s]
   [clojure.string :as str]
   [clojure.tools.logging :as log]
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
   [ring.util.response :as response]))

(def exception-handler
  (err/error-dispatch [context ex]
    [{:exception-type :com.fasterxml.jackson.core.io.JsonEOFException}]
    (do
      (log/warn "JSON parsing error:" ex)
      (assoc context :response (http-resp/handle-validation-error ex)))

    [{:exception-type :com.mongodb.MongoException}]
    (do
      (log/error "MongoDB error:" ex)
      (assoc context :response (http-resp/handle-db-error ex)))

    :else
    (do
      (log/error "Unhandled exception:" ex)
      (assoc context :response (http-resp/server-error (str ex))))))

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
          (http-resp/ok {:result "saved" :id (str (:_id (:result result)))})
          (http-resp/bad-request (:error result))))
      (catch Exception e
        (http-resp/handle-db-error e)))))

(defn get-configs-handler [db]
  (fn [request]
    (try
      (let [config-name (get-in request [:query-params :configName])
            user-email (get-in request [:identity :email])
            
            ;; If a specific configName is requested, find it regardless of owner
            ;; Otherwise, just get all configs for the current user
            query (if config-name
                    {:name config-name}  
                    {:email user-email})
            
            docs (mc/find-maps db "config" query)]
        (http-resp/ok (->> docs (map #(dissoc % :_id)))))
      (catch Exception e
        (http-resp/handle-db-error e)))))

(defn get-scorecards-handler [db]
  (fn [request]
    (try
      (let [include-archived (= "true" (get-in request [:query-params :includeArchived]))
            query (cond-> {:email (get-in request [:identity :email])}
                    (not include-archived) (assoc :archived {:$ne true}))
            docs (mc/find-maps db "scorecards" query)]
        (http-resp/ok (->> docs 
                          (map #(-> % 
                                   (assoc :id (str (:_id %))) 
                                   (dissoc :_id))))))
      (catch Exception e
        (http-resp/handle-db-error e)))))

;; Helper function to find existing overlapping scorecards
(defn find-overlapping-scorecard
  "Find any scorecard for the same user that overlaps with the given date range"
  [db email configName start-date end-date]
  (mc/find-one-as-map db "scorecards" 
                      {:email email
                       :configName configName
                       :archived {:$ne true}
                       :$or [{:startDate {:$lte end-date}
                              :endDate {:$gte start-date}}]}))

(defn validate-score-types [config scores]
  (if (or (nil? config) (nil? scores) (empty? scores))
    false
    (let [metric-types (into {} (map (fn [m] [(:name m) (or (:scoreType m) "numeric")]) (:metrics config)))]
      (try
        (every? (fn [score]
                  (let [metric-name (:metricName score)
                        metric-type (get metric-types metric-name)
                        dev-score (:devScore score)
                        mentor-score (:mentorScore score)]
                    (if (nil? metric-type)
                      false  ;; Metric name not found in config
                      (case metric-type
                        "numeric" (and (number? dev-score) (number? mentor-score)
                                      (<= 0 dev-score 10) (<= 0 mentor-score 10))
                        "checkbox" (and (boolean? dev-score) (boolean? mentor-score))
                        false))))  ;; Unknown score type
                scores)
        (catch Exception _
          false)))))

(defn valid-date? [date-str]
  (try
    (when (and date-str (string? date-str))
      (let [parts (str/split date-str #"-")]
        (and
         (= 3 (count parts))
         (every? #(re-matches #"^\d+$" %) parts))))
    (catch Exception _
      false)))

;; Base64 encoding/decoding functions for ObjectIDs
(defn encode-id [id]
  (let [id-str (if (string? id) id (str id))]
    (.encodeToString (java.util.Base64/getUrlEncoder) (.getBytes id-str))))

(defn decode-id [encoded-id]
  (try
    (String. (.decode (java.util.Base64/getUrlDecoder) encoded-id))
    (catch Exception _
      nil)))

(defn create-scorecard-handler [db]
  (fn [request]
    (try
      (let [scorecard-data (:json-params request)
            email (:email scorecard-data)
            start-date (:startDate scorecard-data)
            end-date (:endDate scorecard-data)
            config-name (:configName scorecard-data)
            is-update (contains? scorecard-data :_id)
            
            ;; If we're updating, get the existing scorecard first
            existing-doc (when is-update (mc/find-map-by-id db "scorecards" (mu/object-id (:_id scorecard-data))))
            
            ;; When updating, use either:
            ;; 1. The user's own config with matching name
            ;; 2. If not found, find the config by name and original owner's email (from existing scorecard)
            config (or 
                    ;; First try to find config for current user
                    (mc/find-one-as-map db "config" {:name config-name :email email})
                    
                    ;; If updating someone else's scorecard, try to find the original config
                    (when (and is-update existing-doc (:email existing-doc))
                      (mc/find-one-as-map db "config" {:name config-name :email (:email existing-doc)})))]
        
        ;; Check if the config exists
        (cond
          ;; Config not found
          (nil? config)
          (http-resp/bad-request "Configuration not found")
          
          ;; Email is missing
          (not email)
          (http-resp/bad-request "Email is required")
          
          ;; Invalid start date format
          (not (valid-date? start-date))
          (http-resp/bad-request "Invalid start date format")
          
          ;; Invalid end date format
          (not (valid-date? end-date)) 
          (http-resp/bad-request "Invalid end date format")
          
          ;; Empty scores or invalid score types/values
          (not (validate-score-types config (:scores scorecard-data)))
          (http-resp/bad-request "Invalid scores - check scores array, types, and ranges (0-10)")
          
          ;; Updating but scorecard not found
          (and is-update (nil? existing-doc))
          (http-resp/bad-request "Scorecard not found")
          
          ;; Prevent updates to archived scorecards
          (and is-update (:archived existing-doc))
          (http-resp/bad-request "Cannot update an archived scorecard")
          
          :else
          (let [;; Only check overlaps for the owner, not for other editors
                check-overlaps (= email (:email existing-doc))
                existing (when check-overlaps 
                           (find-overlapping-scorecard db email config-name start-date end-date))]
            (if (and existing (not= (str (:_id existing)) (:_id scorecard-data)))
              ;; Overlapping date range
              (http-resp/bad-request 
               (str "This time period overlaps with an existing scorecard. "
                    "You already have a scorecard for " 
                    (:startDate existing) " to " 
                    (:endDate existing) "."))
              
              ;; All checks passed, proceed with update/insert
              (let [id (or (:_id scorecard-data) (mu/object-id))
                    oid (if (string? id) (mu/object-id id) id)
                    
                    ;; Preserve important fields when updating
                    preserved-fields (when (and is-update existing-doc)
                                      {:archived (:archived existing-doc)
                                       ;; Keep track of the original owner's email
                                       :originalEmail (or (:originalEmail existing-doc)  
                                                         (:email existing-doc))})
                    
                    ;; For an update by a different user, store who made the change
                    update-metadata (when (and is-update 
                                              existing-doc
                                              (not= email (:email existing-doc)))
                                     {:lastUpdatedBy email
                                      :lastUpdatedAt (.toString (java.time.Instant/now))})
                    
                    ;; Merge everything, ensuring :email is always the original owner's email on update
                    document (-> scorecard-data
                                 (assoc :_id oid)
                                 (dissoc :id :publicId)
                                 (merge preserved-fields)
                                 (merge update-metadata)
                                 (assoc :email (if is-update (:email existing-doc) email)))]
                
                (try
                  (if is-update
                    (mc/update-by-id db "scorecards" oid document)
                    (mc/insert db "scorecards" document))
                  (let [id-str (str oid)
                        encoded-id (encode-id id-str)]
                    (http-resp/ok {:result "saved" :id id-str :encodedId encoded-id}))
                  (catch Exception e
                    (http-resp/handle-db-error e))))))))
      (catch Exception e
        (http-resp/handle-validation-error e)))))

(defn get-scorecard-handler [db]
  (fn [request]
    (let [id (get-in request [:path-params :id])]
      (if-let [id-error (http-resp/handle-id-error id)]
        id-error
        (try
          ;; Check if it's a base64 encoded ID
          (let [decoded-id (decode-id id)
                mongo-id (if decoded-id 
                          (try (mu/object-id decoded-id) (catch Exception _ nil))
                          (try (mu/object-id id) (catch Exception _ nil)))
                doc (when mongo-id (mc/find-map-by-id db "scorecards" mongo-id))]
            (if doc
              (let [id-str (str (:_id doc))
                    encoded-id (encode-id id-str)]
                (http-resp/ok (-> doc 
                                (assoc :id id-str) 
                                (assoc :encodedId encoded-id)
                                (dissoc :_id :publicId))))
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
