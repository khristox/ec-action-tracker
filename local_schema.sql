--
-- PostgreSQL database dump
--

\restrict rxJJKJBtggfxVdTF51eJx4aGcSeXh8GK6hNJdLg7GvyMWjqVQjYPQKsOEyxMcgV

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg13+2)
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: attributevaluetype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.attributevaluetype AS ENUM (
    'STRING',
    'INTEGER',
    'FLOAT',
    'DECIMAL',
    'BOOLEAN',
    'DATE',
    'DATETIME',
    'JSON',
    'ENUM',
    'LIST',
    'URL',
    'EMAIL',
    'PHONE'
);


--
-- Name: charttype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.charttype AS ENUM (
    'BAR',
    'HORIZONTAL_BAR',
    'LINE',
    'PIE',
    'DOUGHNUT',
    'AREA'
);


--
-- Name: datacategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.datacategory AS ENUM (
    'TASKS',
    'MEETINGS',
    'PARTICIPANTS',
    'ACTIONS',
    'PERFORMANCE'
);


--
-- Name: notification_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_category AS ENUM (
    'auth_verification',
    'auth_welcome',
    'auth_password_reset',
    'meeting_notification',
    'other'
);


--
-- Name: notification_channel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_channel AS ENUM (
    'email',
    'sms',
    'whatsapp'
);


--
-- Name: notification_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_status AS ENUM (
    'pending',
    'successful',
    'failed'
);


--
-- Name: recordingstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recordingstatus AS ENUM (
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'DELETED'
);


--
-- Name: recordingtype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recordingtype AS ENUM (
    'VIDEO',
    'AUDIO'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: action_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_comments (
    id uuid NOT NULL,
    action_id uuid NOT NULL,
    comment text NOT NULL,
    attachment_url character varying(1000),
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by_id uuid,
    updated_at timestamp with time zone,
    is_active boolean NOT NULL
);


--
-- Name: action_due_reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_due_reminders (
    id uuid NOT NULL,
    action_id uuid NOT NULL,
    recipient_email character varying(255) NOT NULL,
    reminder_key character varying(60) NOT NULL,
    status character varying(20) NOT NULL,
    attempts integer NOT NULL,
    last_error character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone
);


--
-- Name: action_implementers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_implementers (
    id uuid NOT NULL,
    action_id uuid NOT NULL,
    user_id uuid,
    name character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(50),
    sort_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: action_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_status_history (
    id uuid NOT NULL,
    action_id uuid NOT NULL,
    individual_status_id uuid,
    progress_percentage integer NOT NULL,
    remarks text,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by_id uuid,
    updated_at timestamp with time zone,
    is_active boolean NOT NULL
);


--
-- Name: action_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_statuses (
    id uuid NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    short_name character varying(20),
    description text,
    color character varying(20),
    sort_order integer NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    created_by_id uuid,
    updated_by_id uuid
);


--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: attribute_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attribute_groups (
    id uuid NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    entity_type character varying(50),
    allow_multiple boolean NOT NULL,
    is_required boolean NOT NULL,
    is_system boolean NOT NULL,
    validation_rules json,
    display_order integer NOT NULL,
    extra_metadata json,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    created_by_id uuid,
    updated_by_id uuid
);


--
-- Name: attribute_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attribute_values (
    id uuid NOT NULL,
    attribute_id uuid NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid NOT NULL,
    value_string character varying(1000),
    value_integer integer,
    value_float double precision,
    value_boolean boolean,
    value_date timestamp with time zone,
    value_json json,
    value_type character varying(20) NOT NULL,
    value_display character varying(500),
    inherited_from_id uuid,
    is_inherited boolean NOT NULL,
    extra_metadata json,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    created_by_id uuid,
    updated_by_id uuid
);


--
-- Name: attributes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attributes (
    id uuid NOT NULL,
    group_id uuid NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    short_name character varying(50),
    alt_code character varying(50),
    value_type public.attributevaluetype NOT NULL,
    is_required boolean NOT NULL,
    is_unique boolean NOT NULL,
    is_inheritable boolean NOT NULL,
    can_inherit boolean NOT NULL,
    default_value json,
    default_value_type character varying(20),
    validation_rules json,
    options json,
    description text,
    sort_order integer NOT NULL,
    is_active boolean NOT NULL,
    is_system boolean NOT NULL,
    extra_metadata json,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    created_by_id uuid,
    updated_by_id uuid
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id character(36) NOT NULL,
    user_id character(36),
    username character varying(255),
    user_email character varying(255),
    action character varying(100) NOT NULL,
    table_name character varying(100),
    record_id character varying(255),
    old_data json,
    new_data json,
    old_values json,
    new_values json,
    ip_address character varying(45),
    user_agent text,
    endpoint character varying(500),
    request_id character varying(255),
    changes_summary text,
    error_message text,
    extra_data json,
    "timestamp" timestamp with time zone NOT NULL,
    status character varying(50) NOT NULL
);


--
-- Name: chart_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chart_configurations (
    id integer NOT NULL,
    name character varying,
    title character varying,
    chart_type public.charttype,
    data_category public.datacategory,
    config json,
    query_config json,
    is_default boolean,
    is_active boolean,
    display_order integer,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: chart_configurations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chart_configurations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chart_configurations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chart_configurations_id_seq OWNED BY public.chart_configurations.id;


--
-- Name: chart_data_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chart_data_cache (
    id integer NOT NULL,
    cache_key character varying,
    data json,
    expires_at timestamp without time zone,
    created_at timestamp without time zone
);


--
-- Name: chart_data_cache_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chart_data_cache_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chart_data_cache_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chart_data_cache_id_seq OWNED BY public.chart_data_cache.id;


--
-- Name: entity_attributes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entity_attributes (
    id uuid NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid NOT NULL,
    attribute_id uuid NOT NULL,
    value_text text,
    value_number double precision,
    value_date timestamp with time zone,
    value_boolean boolean,
    value_json json,
    value_type character varying(20) NOT NULL,
    is_system_value boolean NOT NULL,
    is_inherited boolean NOT NULL,
    inherited_from_id uuid,
    version integer NOT NULL,
    is_current boolean NOT NULL,
    extra_data json,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_id uuid,
    updated_at timestamp with time zone,
    updated_by_id uuid
);


--
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id uuid NOT NULL,
    code character varying(50) NOT NULL,
    alt_code character varying(50),
    parent_id uuid,
    level integer NOT NULL,
    name character varying(200) NOT NULL,
    short_name character varying(50),
    native_name character varying(200),
    full_name character varying(500),
    location_type character varying(50),
    location_mode character varying(50) DEFAULT 'address'::character varying NOT NULL,
    status character varying(20),
    latitude double precision,
    longitude double precision,
    gps_data json,
    population integer,
    area double precision,
    density double precision,
    postal_code character varying(20),
    extra_metadata json,
    floor_number integer,
    capacity integer,
    features text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    sort_order integer
);


--
-- Name: COLUMN locations.floor_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.locations.floor_number IS 'Floor number (negative for basement)';


--
-- Name: COLUMN locations.capacity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.locations.capacity IS 'Maximum occupancy';


--
-- Name: COLUMN locations.features; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.locations.features IS 'Features and amenities';


--
-- Name: meeting_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meeting_actions (
    id uuid NOT NULL,
    minute_id uuid,
    description text NOT NULL,
    assigned_to_id uuid,
    assigned_to_name json,
    assigned_by_id uuid,
    assigned_at timestamp with time zone NOT NULL,
    due_date timestamp with time zone,
    priority integer NOT NULL,
    remarks text,
    title character varying(500),
    issue_challenge text,
    is_key_action boolean NOT NULL,
    type_of_action character varying(100),
    date_initiated timestamp with time zone,
    tags json,
    assign_to_meeting_id uuid,
    completed_at timestamp with time zone,
    overall_status_id uuid,
    overall_status_name character varying(100),
    overall_progress_percentage integer NOT NULL,
    created_by_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_by_id uuid,
    updated_at timestamp with time zone,
    is_active boolean NOT NULL
);


--
-- Name: meeting_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meeting_documents (
    id uuid NOT NULL,
    meeting_id uuid NOT NULL,
    title character varying(500),
    file_name character varying(500) NOT NULL,
    file_path character varying(1000) NOT NULL,
    file_size integer,
    mime_type character varying(100),
    document_type_id uuid,
    description text,
    version integer NOT NULL,
    uploaded_by_id uuid,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by_id uuid,
    updated_at timestamp with time zone,
    is_active boolean NOT NULL,
    ocr_text text,
    ocr_processed_at timestamp with time zone,
    ocr_language character varying(10)
);


--
-- Name: meeting_minutes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meeting_minutes (
    id uuid NOT NULL,
    meeting_id uuid NOT NULL,
    topic character varying(500) NOT NULL,
    discussion text,
    decisions text,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by_id uuid,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by_id uuid,
    updated_at timestamp with time zone,
    is_active boolean NOT NULL,
    is_default boolean NOT NULL,
    is_system boolean DEFAULT false NOT NULL
);


--
-- Name: meeting_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meeting_participants (
    id uuid NOT NULL,
    meeting_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255),
    telephone character varying(50),
    title character varying(255),
    organization character varying(255),
    is_chairperson boolean NOT NULL,
    is_secretary boolean NOT NULL,
    attendance_status character varying(50),
    apology_comment text,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by_id uuid,
    updated_at timestamp with time zone,
    is_active boolean NOT NULL
);


--
-- Name: meeting_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meeting_status_history (
    id uuid NOT NULL,
    meeting_id uuid NOT NULL,
    status_id uuid NOT NULL,
    comment text,
    status_date timestamp without time zone NOT NULL,
    created_by_id uuid,
    created_at timestamp without time zone,
    updated_by_id uuid,
    updated_at timestamp without time zone,
    is_active boolean
);


--
-- Name: meetings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meetings (
    id uuid NOT NULL,
    title character varying(500) NOT NULL,
    description text,
    department_id uuid,
    location_id uuid,
    location_text character varying(500),
    gps_coordinates character varying(100),
    meeting_date timestamp with time zone NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone,
    duration_minutes integer,
    platform character varying(100),
    meeting_link character varying(500),
    meeting_id_online character varying(255),
    passcode character varying(100),
    dial_in_numbers json,
    agenda text,
    facilitator character varying(255),
    chairperson_name character varying(255),
    chairperson_id uuid,
    secretary_id uuid,
    status_id uuid,
    is_recurring boolean NOT NULL,
    recurring_meeting_id uuid,
    occurrence_number integer,
    visibility character varying(50) NOT NULL,
    restricted_department_id uuid,
    reminder_sent_at timestamp with time zone,
    reminder_sent_count integer NOT NULL,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by_id uuid,
    updated_at timestamp with time zone,
    is_active boolean NOT NULL,
    is_deleted boolean NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: menus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menus (
    id uuid NOT NULL,
    code character varying(50) NOT NULL,
    title character varying(100) NOT NULL,
    icon character varying(50),
    icon_type character varying(50),
    icon_library character varying(50),
    icon_color character varying(20),
    icon_size character varying(10),
    icon_animation character varying(50),
    path character varying(255),
    parent_id uuid,
    sort_order integer NOT NULL,
    is_active boolean NOT NULL,
    requires_auth boolean NOT NULL,
    target character varying(20) NOT NULL,
    badge character varying(50),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid NOT NULL,
    channel public.notification_channel NOT NULL,
    user_id uuid,
    participant_id uuid,
    meeting_id uuid,
    recipient character varying(255) NOT NULL,
    recipient_name character varying(255),
    subject character varying(500),
    content text NOT NULL,
    template_name character varying(100),
    category public.notification_category NOT NULL,
    status public.notification_status NOT NULL,
    error_message text,
    sent_at timestamp with time zone,
    tracking_id uuid,
    is_opened boolean NOT NULL,
    opened_at timestamp with time zone,
    open_count integer NOT NULL,
    provider_message_id character varying(255),
    extra_data json,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: organization_nodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_nodes (
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    title character varying(200) NOT NULL,
    parent_id uuid,
    level integer NOT NULL,
    path character varying(1000) NOT NULL,
    "order" integer NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    email character varying(200),
    phone character varying(50),
    department_code character varying(50),
    location character varying(200),
    employee_count integer NOT NULL,
    budget double precision NOT NULL,
    color character varying(20) NOT NULL,
    additional_metadata json NOT NULL
);


--
-- Name: participant_list_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.participant_list_members (
    participant_list_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    added_at timestamp with time zone DEFAULT now(),
    added_by_id uuid
);


--
-- Name: participant_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.participant_lists (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_global boolean NOT NULL,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by_id uuid,
    updated_at timestamp with time zone,
    is_active boolean NOT NULL
);


--
-- Name: participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.participants (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255),
    telephone character varying(50),
    title character varying(255),
    organization character varying(255),
    notes text,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by_id uuid,
    updated_at timestamp with time zone,
    is_active boolean NOT NULL
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(50) NOT NULL,
    resource character varying(50) NOT NULL,
    action character varying(50) NOT NULL,
    description character varying(255),
    category character varying(50),
    conditions json,
    is_system boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN permissions.conditions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.permissions.conditions IS 'Abac conditions for dynamic filtering';


--
-- Name: recurring_meeting_occurrences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_meeting_occurrences (
    id uuid NOT NULL,
    recurring_meeting_id uuid NOT NULL,
    meeting_id uuid NOT NULL,
    occurrence_number integer NOT NULL,
    scheduled_date timestamp without time zone NOT NULL,
    status character varying(20),
    rescheduled_to_date timestamp without time zone,
    cancellation_reason character varying(500),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


--
-- Name: recurring_meetings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_meetings (
    id uuid NOT NULL,
    title character varying(500) NOT NULL,
    description text,
    department_id uuid,
    visibility character varying(50) NOT NULL,
    restricted_department_id uuid,
    recurrence_type_id uuid NOT NULL,
    recurrence_interval integer,
    recurrence_days json,
    recurrence_day_of_month integer,
    recurrence_week_of_month_id uuid,
    recurrence_day_of_week_id uuid,
    recurrence_end_date timestamp without time zone,
    recurrence_max_occurrences integer,
    recurrence_end_after_occurrences integer,
    meeting_template_id uuid,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    duration_minutes integer,
    location_id uuid,
    location_text character varying(500),
    platform character varying(50),
    meeting_link character varying(500),
    chairperson_id uuid,
    secretary_id uuid,
    facilitator character varying(255),
    default_participant_ids json,
    agenda text,
    additional_info json,
    status_id uuid NOT NULL,
    last_occurrence_date timestamp without time zone,
    next_occurrence_date timestamp without time zone,
    occurrences_count integer,
    total_occurrences_generated integer,
    created_by_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    is_deleted boolean,
    deleted_at timestamp without time zone
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token character varying(500) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    is_active boolean,
    revoked_at timestamp with time zone,
    user_agent text,
    ip_address character varying(45),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


--
-- Name: role_menu_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_menu_permissions (
    id uuid NOT NULL,
    role_id uuid NOT NULL,
    menu_id uuid NOT NULL,
    can_view boolean DEFAULT true NOT NULL,
    can_access boolean DEFAULT true NOT NULL,
    can_show_mb_bottom boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


--
-- Name: COLUMN role_menu_permissions.can_show_mb_bottom; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.role_menu_permissions.can_show_mb_bottom IS 'Visibility on mobile bottom navigation bars';


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid NOT NULL,
    name character varying(50) NOT NULL,
    code character varying(50) NOT NULL,
    description character varying(255),
    is_system_role boolean NOT NULL,
    is_active boolean,
    priority integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: token_blacklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.token_blacklist (
    id integer NOT NULL,
    token character varying(500) NOT NULL,
    user_id character varying(36) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: token_blacklist_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.token_blacklist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: token_blacklist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.token_blacklist_id_seq OWNED BY public.token_blacklist.id;


--
-- Name: user_attributes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_attributes (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    attribute_id uuid NOT NULL,
    value_text text,
    value_number json,
    value_date timestamp with time zone,
    value_boolean json,
    value_json json,
    extra_metadata json,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid
);


--
-- Name: user_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_departments (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    department_id uuid NOT NULL,
    role character varying(50) NOT NULL,
    status character varying(50) NOT NULL,
    is_primary boolean,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    title character varying(200),
    responsibilities json,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    created_by uuid,
    notes character varying(500)
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    assigned_by uuid,
    is_active boolean,
    entity_type character varying(50),
    entity_id uuid,
    extra_metadata json
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    username character varying(100),
    hashed_password character varying(255) NOT NULL,
    preferred_language character varying(10) NOT NULL,
    preferred_timezone character varying(50) NOT NULL,
    preferred_currency character varying(3),
    is_active boolean,
    is_verified boolean,
    is_superuser boolean,
    first_name character varying(100),
    last_name character varying(100),
    middle_name character varying(100),
    phone character varying(20),
    alternate_phone character varying(20),
    date_of_birth date,
    address character varying(500),
    city character varying(100),
    state character varying(100),
    country character varying(100),
    postal_code character varying(20),
    occupation character varying(100),
    education character varying(200),
    bio character varying(500),
    gender_attribute_id uuid,
    language_attribute_id uuid,
    currency_attribute_id uuid,
    country_attribute_id uuid,
    nationality_attribute_id uuid,
    location_id uuid,
    last_login timestamp with time zone,
    password_changed_at timestamp with time zone,
    login_attempts integer,
    locked_until timestamp with time zone,
    lock_reason character varying(255),
    verification_token character varying(1000),
    verification_token_expires timestamp with time zone,
    reset_token character varying(255),
    reset_token_expires timestamp with time zone,
    verification_sent_at timestamp with time zone,
    verification_sent_count integer,
    reset_sent_at timestamp with time zone,
    reset_sent_count integer,
    profile_picture bytea,
    profile_picture_type character varying(50),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid
);


--
-- Name: chart_configurations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_configurations ALTER COLUMN id SET DEFAULT nextval('public.chart_configurations_id_seq'::regclass);


--
-- Name: chart_data_cache id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_data_cache ALTER COLUMN id SET DEFAULT nextval('public.chart_data_cache_id_seq'::regclass);


--
-- Name: token_blacklist id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_blacklist ALTER COLUMN id SET DEFAULT nextval('public.token_blacklist_id_seq'::regclass);


--
-- Name: action_comments action_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_comments
    ADD CONSTRAINT action_comments_pkey PRIMARY KEY (id);


--
-- Name: action_due_reminders action_due_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_due_reminders
    ADD CONSTRAINT action_due_reminders_pkey PRIMARY KEY (id);


--
-- Name: action_implementers action_implementers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_implementers
    ADD CONSTRAINT action_implementers_pkey PRIMARY KEY (id);


--
-- Name: action_status_history action_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_status_history
    ADD CONSTRAINT action_status_history_pkey PRIMARY KEY (id);


--
-- Name: action_statuses action_statuses_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_statuses
    ADD CONSTRAINT action_statuses_code_key UNIQUE (code);


--
-- Name: action_statuses action_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_statuses
    ADD CONSTRAINT action_statuses_pkey PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: attribute_groups attribute_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attribute_groups
    ADD CONSTRAINT attribute_groups_pkey PRIMARY KEY (id);


--
-- Name: attribute_values attribute_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attribute_values
    ADD CONSTRAINT attribute_values_pkey PRIMARY KEY (id);


--
-- Name: attributes attributes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attributes
    ADD CONSTRAINT attributes_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: chart_configurations chart_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_configurations
    ADD CONSTRAINT chart_configurations_pkey PRIMARY KEY (id);


--
-- Name: chart_data_cache chart_data_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_data_cache
    ADD CONSTRAINT chart_data_cache_pkey PRIMARY KEY (id);


--
-- Name: entity_attributes entity_attributes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_attributes
    ADD CONSTRAINT entity_attributes_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: meeting_actions meeting_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_actions
    ADD CONSTRAINT meeting_actions_pkey PRIMARY KEY (id);


--
-- Name: meeting_documents meeting_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_documents
    ADD CONSTRAINT meeting_documents_pkey PRIMARY KEY (id);


--
-- Name: meeting_minutes meeting_minutes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_minutes
    ADD CONSTRAINT meeting_minutes_pkey PRIMARY KEY (id);


--
-- Name: meeting_participants meeting_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_participants
    ADD CONSTRAINT meeting_participants_pkey PRIMARY KEY (id);


--
-- Name: meeting_status_history meeting_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_status_history
    ADD CONSTRAINT meeting_status_history_pkey PRIMARY KEY (id);


--
-- Name: meetings meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_pkey PRIMARY KEY (id);


--
-- Name: menus menus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menus
    ADD CONSTRAINT menus_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: organization_nodes organization_nodes_department_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_nodes
    ADD CONSTRAINT organization_nodes_department_code_key UNIQUE (department_code);


--
-- Name: organization_nodes organization_nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_nodes
    ADD CONSTRAINT organization_nodes_pkey PRIMARY KEY (id);


--
-- Name: participant_list_members participant_list_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participant_list_members
    ADD CONSTRAINT participant_list_members_pkey PRIMARY KEY (participant_list_id, participant_id);


--
-- Name: participant_lists participant_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participant_lists
    ADD CONSTRAINT participant_lists_pkey PRIMARY KEY (id);


--
-- Name: participants participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: recurring_meeting_occurrences recurring_meeting_occurrences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_meeting_occurrences
    ADD CONSTRAINT recurring_meeting_occurrences_pkey PRIMARY KEY (id);


--
-- Name: recurring_meetings recurring_meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_meetings
    ADD CONSTRAINT recurring_meetings_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_key UNIQUE (token);


--
-- Name: role_menu_permissions role_menu_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_menu_permissions
    ADD CONSTRAINT role_menu_permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: token_blacklist token_blacklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_blacklist
    ADD CONSTRAINT token_blacklist_pkey PRIMARY KEY (id);


--
-- Name: action_due_reminders uq_action_due_reminder; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_due_reminders
    ADD CONSTRAINT uq_action_due_reminder UNIQUE (action_id, recipient_email, reminder_key);


--
-- Name: recurring_meeting_occurrences uq_rmo_series_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_meeting_occurrences
    ADD CONSTRAINT uq_rmo_series_number UNIQUE (recurring_meeting_id, occurrence_number);


--
-- Name: role_menu_permissions uq_role_menu; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_menu_permissions
    ADD CONSTRAINT uq_role_menu UNIQUE (role_id, menu_id);


--
-- Name: user_attributes user_attributes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_attributes
    ADD CONSTRAINT user_attributes_pkey PRIMARY KEY (id);


--
-- Name: user_departments user_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_departments
    ADD CONSTRAINT user_departments_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_attribute_groups_code_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_attribute_groups_code_entity ON public.attribute_groups USING btree (code, entity_type);


--
-- Name: idx_attribute_groups_display_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attribute_groups_display_order ON public.attribute_groups USING btree (display_order);


--
-- Name: idx_attribute_groups_entity_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attribute_groups_entity_type ON public.attribute_groups USING btree (entity_type);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_record_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_record_id ON public.audit_logs USING btree (record_id);


--
-- Name: idx_audit_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_status ON public.audit_logs USING btree (status);


--
-- Name: idx_audit_logs_table_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_table_name ON public.audit_logs USING btree (table_name);


--
-- Name: idx_audit_logs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs USING btree ("timestamp");


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_location_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_location_code ON public.locations USING btree (code);


--
-- Name: idx_location_code_level; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_location_code_level ON public.locations USING btree (code, level);


--
-- Name: idx_location_hierarchy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_location_hierarchy ON public.locations USING btree (level, parent_id);


--
-- Name: idx_location_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_location_level ON public.locations USING btree (level);


--
-- Name: idx_location_mode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_location_mode ON public.locations USING btree (location_mode);


--
-- Name: idx_location_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_location_name ON public.locations USING btree (name);


--
-- Name: idx_location_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_location_parent ON public.locations USING btree (parent_id);


--
-- Name: idx_location_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_location_search ON public.locations USING btree (name, code, level);


--
-- Name: idx_location_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_location_status ON public.locations USING btree (status);


--
-- Name: idx_location_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_location_type ON public.locations USING btree (location_type);


--
-- Name: idx_menu_code_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_code_active ON public.menus USING btree (code, is_active);


--
-- Name: idx_menu_parent_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_parent_active ON public.menus USING btree (parent_id, is_active);


--
-- Name: idx_menu_sort_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_sort_order ON public.menus USING btree (sort_order);


--
-- Name: idx_mobile_nav_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mobile_nav_lookup ON public.role_menu_permissions USING btree (role_id, can_show_mb_bottom);


--
-- Name: idx_org_department_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_department_code ON public.organization_nodes USING btree (department_code);


--
-- Name: idx_org_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_is_active ON public.organization_nodes USING btree (is_active);


--
-- Name: idx_org_level_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_level_order ON public.organization_nodes USING btree (level, "order");


--
-- Name: idx_org_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_parent_id ON public.organization_nodes USING btree (parent_id);


--
-- Name: idx_org_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_path ON public.organization_nodes USING btree (path);


--
-- Name: idx_permission_resource_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permission_resource_action ON public.permissions USING btree (resource, action);


--
-- Name: idx_refresh_token_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_token_expires ON public.refresh_tokens USING btree (expires_at);


--
-- Name: idx_role_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_lookup ON public.roles USING btree (code, is_system_role);


--
-- Name: idx_role_menu_access; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_menu_access ON public.role_menu_permissions USING btree (role_id, can_view, can_access);


--
-- Name: idx_user_attribute_attribute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_attribute_attribute ON public.user_attributes USING btree (attribute_id);


--
-- Name: idx_user_attribute_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_attribute_created_at ON public.user_attributes USING btree (created_at);


--
-- Name: idx_user_attribute_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_attribute_created_by ON public.user_attributes USING btree (created_by);


--
-- Name: idx_user_attribute_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_user_attribute_unique ON public.user_attributes USING btree (user_id, attribute_id);


--
-- Name: idx_user_attribute_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_attribute_user ON public.user_attributes USING btree (user_id);


--
-- Name: idx_user_country_attribute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_country_attribute ON public.users USING btree (country_attribute_id);


--
-- Name: idx_user_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_created_at ON public.users USING btree (created_at);


--
-- Name: idx_user_currency_attribute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_currency_attribute ON public.users USING btree (currency_attribute_id);


--
-- Name: idx_user_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_email ON public.users USING btree (email);


--
-- Name: idx_user_gender_attribute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_gender_attribute ON public.users USING btree (gender_attribute_id);


--
-- Name: idx_user_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_is_active ON public.users USING btree (is_active);


--
-- Name: idx_user_is_superuser; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_is_superuser ON public.users USING btree (is_superuser);


--
-- Name: idx_user_language_attribute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_language_attribute ON public.users USING btree (language_attribute_id);


--
-- Name: idx_user_last_login; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_last_login ON public.users USING btree (last_login);


--
-- Name: idx_user_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_location ON public.users USING btree (location_id);


--
-- Name: idx_user_nationality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_nationality ON public.users USING btree (nationality_attribute_id);


--
-- Name: idx_user_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_phone ON public.users USING btree (phone);


--
-- Name: idx_user_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_username ON public.users USING btree (username);


--
-- Name: idx_user_verification_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_verification_status ON public.users USING btree (is_verified, is_active);


--
-- Name: ix_ac_action_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ac_action_id ON public.action_comments USING btree (action_id);


--
-- Name: ix_ac_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ac_created_at ON public.action_comments USING btree (created_at);


--
-- Name: ix_ac_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ac_created_by ON public.action_comments USING btree (created_by_id);


--
-- Name: ix_ac_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ac_updated_by ON public.action_comments USING btree (updated_by_id);


--
-- Name: ix_action_due_reminders_action_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_action_due_reminders_action_id ON public.action_due_reminders USING btree (action_id);


--
-- Name: ix_action_implementers_action_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_action_implementers_action_id ON public.action_implementers USING btree (action_id);


--
-- Name: ix_action_implementers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_action_implementers_user_id ON public.action_implementers USING btree (user_id);


--
-- Name: ix_action_statuses_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_action_statuses_code ON public.action_statuses USING btree (code);


--
-- Name: ix_action_statuses_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_action_statuses_is_active ON public.action_statuses USING btree (is_active);


--
-- Name: ix_action_statuses_sort_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_action_statuses_sort_order ON public.action_statuses USING btree (sort_order);


--
-- Name: ix_ash_action_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ash_action_id ON public.action_status_history USING btree (action_id);


--
-- Name: ix_ash_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ash_created_at ON public.action_status_history USING btree (created_at);


--
-- Name: ix_ash_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ash_created_by ON public.action_status_history USING btree (created_by_id);


--
-- Name: ix_ash_individual_status_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ash_individual_status_id ON public.action_status_history USING btree (individual_status_id);


--
-- Name: ix_ash_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ash_updated_by ON public.action_status_history USING btree (updated_by_id);


--
-- Name: ix_attribute_groups_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_attribute_groups_code ON public.attribute_groups USING btree (code);


--
-- Name: ix_attribute_groups_entity_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attribute_groups_entity_type ON public.attribute_groups USING btree (entity_type);


--
-- Name: ix_attribute_groups_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attribute_groups_id ON public.attribute_groups USING btree (id);


--
-- Name: ix_attribute_values_attribute_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_attribute_values_attribute_entity ON public.attribute_values USING btree (attribute_id, entity_type, entity_id);


--
-- Name: ix_attribute_values_attribute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attribute_values_attribute_id ON public.attribute_values USING btree (attribute_id);


--
-- Name: ix_attribute_values_boolean; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attribute_values_boolean ON public.attribute_values USING btree (value_boolean);


--
-- Name: ix_attribute_values_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attribute_values_entity ON public.attribute_values USING btree (entity_type, entity_id);


--
-- Name: ix_attribute_values_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attribute_values_entity_id ON public.attribute_values USING btree (entity_id);


--
-- Name: ix_attribute_values_entity_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attribute_values_entity_type ON public.attribute_values USING btree (entity_type);


--
-- Name: ix_attribute_values_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attribute_values_id ON public.attribute_values USING btree (id);


--
-- Name: ix_attribute_values_integer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attribute_values_integer ON public.attribute_values USING btree (value_integer);


--
-- Name: ix_attribute_values_string; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attribute_values_string ON public.attribute_values USING btree (value_string);


--
-- Name: ix_attributes_group_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_attributes_group_code ON public.attributes USING btree (group_id, code);


--
-- Name: ix_attributes_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attributes_group_id ON public.attributes USING btree (group_id);


--
-- Name: ix_attributes_group_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attributes_group_sort ON public.attributes USING btree (group_id, sort_order);


--
-- Name: ix_attributes_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attributes_id ON public.attributes USING btree (id);


--
-- Name: ix_attributes_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attributes_is_active ON public.attributes USING btree (is_active);


--
-- Name: ix_attributes_t_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attributes_t_is_active ON public.attributes USING btree (is_active);


--
-- Name: ix_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: ix_audit_logs_record_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_logs_record_id ON public.audit_logs USING btree (record_id);


--
-- Name: ix_audit_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_logs_status ON public.audit_logs USING btree (status);


--
-- Name: ix_audit_logs_table_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_logs_table_name ON public.audit_logs USING btree (table_name);


--
-- Name: ix_audit_logs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_logs_timestamp ON public.audit_logs USING btree ("timestamp");


--
-- Name: ix_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: ix_chart_configurations_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chart_configurations_id ON public.chart_configurations USING btree (id);


--
-- Name: ix_chart_configurations_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_chart_configurations_name ON public.chart_configurations USING btree (name);


--
-- Name: ix_chart_data_cache_cache_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_chart_data_cache_cache_key ON public.chart_data_cache USING btree (cache_key);


--
-- Name: ix_chart_data_cache_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chart_data_cache_id ON public.chart_data_cache USING btree (id);


--
-- Name: ix_entity_attributes_attribute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_entity_attributes_attribute ON public.entity_attributes USING btree (attribute_id);


--
-- Name: ix_entity_attributes_attribute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_entity_attributes_attribute_id ON public.entity_attributes USING btree (attribute_id);


--
-- Name: ix_entity_attributes_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_entity_attributes_entity ON public.entity_attributes USING btree (entity_type, entity_id);


--
-- Name: ix_entity_attributes_entity_current; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_entity_attributes_entity_current ON public.entity_attributes USING btree (entity_type, entity_id, is_current);


--
-- Name: ix_entity_attributes_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_entity_attributes_entity_id ON public.entity_attributes USING btree (entity_id);


--
-- Name: ix_entity_attributes_entity_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_entity_attributes_entity_type ON public.entity_attributes USING btree (entity_type);


--
-- Name: ix_entity_attributes_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_entity_attributes_id ON public.entity_attributes USING btree (id);


--
-- Name: ix_entity_attributes_is_current; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_entity_attributes_is_current ON public.entity_attributes USING btree (is_current);


--
-- Name: ix_entity_attributes_unique_current; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_entity_attributes_unique_current ON public.entity_attributes USING btree (entity_type, entity_id, attribute_id) WHERE (is_current = true);


--
-- Name: ix_locations_alt_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_locations_alt_code ON public.locations USING btree (alt_code);


--
-- Name: ix_locations_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_locations_code ON public.locations USING btree (code);


--
-- Name: ix_locations_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_locations_id ON public.locations USING btree (id);


--
-- Name: ix_locations_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_locations_level ON public.locations USING btree (level);


--
-- Name: ix_locations_location_mode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_locations_location_mode ON public.locations USING btree (location_mode);


--
-- Name: ix_locations_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_locations_parent_id ON public.locations USING btree (parent_id);


--
-- Name: ix_locations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_locations_status ON public.locations USING btree (status);


--
-- Name: ix_md_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_md_created_by ON public.meeting_documents USING btree (created_by_id);


--
-- Name: ix_md_document_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_md_document_type_id ON public.meeting_documents USING btree (document_type_id);


--
-- Name: ix_md_meeting_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_md_meeting_id ON public.meeting_documents USING btree (meeting_id);


--
-- Name: ix_md_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_md_updated_by ON public.meeting_documents USING btree (updated_by_id);


--
-- Name: ix_md_uploaded_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_md_uploaded_at ON public.meeting_documents USING btree (uploaded_at);


--
-- Name: ix_md_uploaded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_md_uploaded_by ON public.meeting_documents USING btree (uploaded_by_id);


--
-- Name: ix_meeting_actions_assign_to_meeting; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_meeting_actions_assign_to_meeting ON public.meeting_actions USING btree (assign_to_meeting_id);


--
-- Name: ix_meeting_actions_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_meeting_actions_assigned_to ON public.meeting_actions USING btree (assigned_to_id);


--
-- Name: ix_meeting_actions_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_meeting_actions_created_by ON public.meeting_actions USING btree (created_by_id);


--
-- Name: ix_meeting_actions_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_meeting_actions_due_date ON public.meeting_actions USING btree (due_date);


--
-- Name: ix_meeting_actions_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_meeting_actions_is_active ON public.meeting_actions USING btree (is_active);


--
-- Name: ix_meeting_actions_minute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_meeting_actions_minute_id ON public.meeting_actions USING btree (minute_id);


--
-- Name: ix_meeting_actions_overall_status_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_meeting_actions_overall_status_name ON public.meeting_actions USING btree (overall_status_name);


--
-- Name: ix_meeting_actions_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_meeting_actions_priority ON public.meeting_actions USING btree (priority);


--
-- Name: ix_meeting_actions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_meeting_actions_status ON public.meeting_actions USING btree (overall_status_id);


--
-- Name: ix_meeting_actions_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_meeting_actions_updated_by ON public.meeting_actions USING btree (updated_by_id);


--
-- Name: ix_meetings_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_meetings_created_by ON public.meetings USING btree (created_by_id);


--
-- Name: ix_meetings_department_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_meetings_department_id ON public.meetings USING btree (department_id);


--
-- Name: ix_meetings_is_recurring; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_meetings_is_recurring ON public.meetings USING btree (is_recurring);


--
-- Name: ix_meetings_meeting_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_meetings_meeting_date ON public.meetings USING btree (meeting_date);


--
-- Name: ix_meetings_recurring_meeting_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_meetings_recurring_meeting_id ON public.meetings USING btree (recurring_meeting_id);


--
-- Name: ix_meetings_restricted_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_meetings_restricted_department ON public.meetings USING btree (restricted_department_id);


--
-- Name: ix_meetings_status_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_meetings_status_id ON public.meetings USING btree (status_id);


--
-- Name: ix_meetings_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_meetings_title ON public.meetings USING btree (title);


--
-- Name: ix_meetings_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_meetings_updated_by ON public.meetings USING btree (updated_by_id);


--
-- Name: ix_menus_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_menus_code ON public.menus USING btree (code);


--
-- Name: ix_menus_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_menus_parent_id ON public.menus USING btree (parent_id);


--
-- Name: ix_mm_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mm_created_by ON public.meeting_minutes USING btree (created_by_id);


--
-- Name: ix_mm_is_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mm_is_default ON public.meeting_minutes USING btree (is_default);


--
-- Name: ix_mm_meeting_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mm_meeting_id ON public.meeting_minutes USING btree (meeting_id);


--
-- Name: ix_mm_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mm_timestamp ON public.meeting_minutes USING btree ("timestamp");


--
-- Name: ix_mm_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mm_updated_by ON public.meeting_minutes USING btree (updated_by_id);


--
-- Name: ix_mp_attendance_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mp_attendance_status ON public.meeting_participants USING btree (attendance_status);


--
-- Name: ix_mp_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mp_created_by ON public.meeting_participants USING btree (created_by_id);


--
-- Name: ix_mp_meeting_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mp_meeting_id ON public.meeting_participants USING btree (meeting_id);


--
-- Name: ix_mp_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mp_name ON public.meeting_participants USING btree (name);


--
-- Name: ix_mp_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mp_updated_by ON public.meeting_participants USING btree (updated_by_id);


--
-- Name: ix_notifications_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notifications_category ON public.notifications USING btree (category);


--
-- Name: ix_notifications_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notifications_channel ON public.notifications USING btree (channel);


--
-- Name: ix_notifications_meeting_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notifications_meeting_id ON public.notifications USING btree (meeting_id);


--
-- Name: ix_notifications_participant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notifications_participant_id ON public.notifications USING btree (participant_id);


--
-- Name: ix_notifications_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notifications_recipient ON public.notifications USING btree (recipient);


--
-- Name: ix_notifications_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notifications_status ON public.notifications USING btree (status);


--
-- Name: ix_notifications_tracking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_notifications_tracking_id ON public.notifications USING btree (tracking_id);


--
-- Name: ix_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: ix_occurrences_meeting; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_occurrences_meeting ON public.recurring_meeting_occurrences USING btree (meeting_id);


--
-- Name: ix_occurrences_recurring_meeting; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_occurrences_recurring_meeting ON public.recurring_meeting_occurrences USING btree (recurring_meeting_id);


--
-- Name: ix_occurrences_recurring_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_occurrences_recurring_status_date ON public.recurring_meeting_occurrences USING btree (recurring_meeting_id, status, scheduled_date);


--
-- Name: ix_occurrences_scheduled_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_occurrences_scheduled_date ON public.recurring_meeting_occurrences USING btree (scheduled_date);


--
-- Name: ix_occurrences_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_occurrences_status ON public.recurring_meeting_occurrences USING btree (status);


--
-- Name: ix_participant_lists_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_participant_lists_created_by ON public.participant_lists USING btree (created_by_id);


--
-- Name: ix_participant_lists_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_participant_lists_name ON public.participant_lists USING btree (name);


--
-- Name: ix_participant_lists_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_participant_lists_updated_by ON public.participant_lists USING btree (updated_by_id);


--
-- Name: ix_participants_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_participants_created_by ON public.participants USING btree (created_by_id);


--
-- Name: ix_participants_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_participants_email ON public.participants USING btree (email);


--
-- Name: ix_participants_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_participants_name ON public.participants USING btree (name);


--
-- Name: ix_participants_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_participants_updated_by ON public.participants USING btree (updated_by_id);


--
-- Name: ix_permissions_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_permissions_action ON public.permissions USING btree (action);


--
-- Name: ix_permissions_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_permissions_code ON public.permissions USING btree (code);


--
-- Name: ix_permissions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_permissions_created_at ON public.permissions USING btree (created_at);


--
-- Name: ix_permissions_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_permissions_name ON public.permissions USING btree (name);


--
-- Name: ix_permissions_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_permissions_resource ON public.permissions USING btree (resource);


--
-- Name: ix_plm_added_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_plm_added_by ON public.participant_list_members USING btree (added_by_id);


--
-- Name: ix_plm_list_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_plm_list_id ON public.participant_list_members USING btree (participant_list_id);


--
-- Name: ix_plm_participant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_plm_participant_id ON public.participant_list_members USING btree (participant_id);


--
-- Name: ix_recurring_meeting_occurrences_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recurring_meeting_occurrences_id ON public.recurring_meeting_occurrences USING btree (id);


--
-- Name: ix_recurring_meetings_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recurring_meetings_created_at ON public.recurring_meetings USING btree (created_at);


--
-- Name: ix_recurring_meetings_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recurring_meetings_created_by ON public.recurring_meetings USING btree (created_by_id);


--
-- Name: ix_recurring_meetings_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recurring_meetings_department ON public.recurring_meetings USING btree (department_id);


--
-- Name: ix_recurring_meetings_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recurring_meetings_id ON public.recurring_meetings USING btree (id);


--
-- Name: ix_recurring_meetings_is_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recurring_meetings_is_deleted ON public.recurring_meetings USING btree (is_deleted);


--
-- Name: ix_recurring_meetings_next_occurrence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recurring_meetings_next_occurrence ON public.recurring_meetings USING btree (next_occurrence_date);


--
-- Name: ix_recurring_meetings_recurrence_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recurring_meetings_recurrence_type ON public.recurring_meetings USING btree (recurrence_type_id);


--
-- Name: ix_recurring_meetings_restricted_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recurring_meetings_restricted_department ON public.recurring_meetings USING btree (restricted_department_id);


--
-- Name: ix_recurring_meetings_status_next_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recurring_meetings_status_next_date ON public.recurring_meetings USING btree (status_id, next_occurrence_date);


--
-- Name: ix_recurring_meetings_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recurring_meetings_visibility ON public.recurring_meetings USING btree (visibility);


--
-- Name: ix_refresh_tokens_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_refresh_tokens_id ON public.refresh_tokens USING btree (id);


--
-- Name: ix_refresh_tokens_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_refresh_tokens_is_active ON public.refresh_tokens USING btree (is_active);


--
-- Name: ix_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: ix_role_menu_permissions_menu_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_role_menu_permissions_menu_id ON public.role_menu_permissions USING btree (menu_id);


--
-- Name: ix_role_menu_permissions_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_role_menu_permissions_role_id ON public.role_menu_permissions USING btree (role_id);


--
-- Name: ix_roles_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_roles_code ON public.roles USING btree (code);


--
-- Name: ix_roles_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_roles_created_at ON public.roles USING btree (created_at);


--
-- Name: ix_roles_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_roles_name ON public.roles USING btree (name);


--
-- Name: ix_token_blacklist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_token_blacklist_id ON public.token_blacklist USING btree (id);


--
-- Name: ix_token_blacklist_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_token_blacklist_token ON public.token_blacklist USING btree (token);


--
-- Name: ix_user_attributes_attribute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_attributes_attribute_id ON public.user_attributes USING btree (attribute_id);


--
-- Name: ix_user_attributes_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_attributes_created_by ON public.user_attributes USING btree (created_by);


--
-- Name: ix_user_attributes_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_attributes_id ON public.user_attributes USING btree (id);


--
-- Name: ix_user_attributes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_attributes_user_id ON public.user_attributes USING btree (user_id);


--
-- Name: ix_user_departments_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_departments_id ON public.user_departments USING btree (id);


--
-- Name: ix_users_country_attribute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_country_attribute_id ON public.users USING btree (country_attribute_id);


--
-- Name: ix_users_currency_attribute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_currency_attribute_id ON public.users USING btree (currency_attribute_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_gender_attribute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_gender_attribute_id ON public.users USING btree (gender_attribute_id);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- Name: ix_users_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_is_active ON public.users USING btree (is_active);


--
-- Name: ix_users_is_superuser; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_is_superuser ON public.users USING btree (is_superuser);


--
-- Name: ix_users_language_attribute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_language_attribute_id ON public.users USING btree (language_attribute_id);


--
-- Name: ix_users_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_location_id ON public.users USING btree (location_id);


--
-- Name: ix_users_nationality_attribute_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_nationality_attribute_id ON public.users USING btree (nationality_attribute_id);


--
-- Name: ix_users_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_phone ON public.users USING btree (phone);


--
-- Name: ix_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_username ON public.users USING btree (username);


--
-- Name: action_comments action_comments_action_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_comments
    ADD CONSTRAINT action_comments_action_id_fkey FOREIGN KEY (action_id) REFERENCES public.meeting_actions(id) ON DELETE CASCADE;


--
-- Name: action_comments action_comments_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_comments
    ADD CONSTRAINT action_comments_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: action_comments action_comments_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_comments
    ADD CONSTRAINT action_comments_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: action_due_reminders action_due_reminders_action_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_due_reminders
    ADD CONSTRAINT action_due_reminders_action_id_fkey FOREIGN KEY (action_id) REFERENCES public.meeting_actions(id) ON DELETE CASCADE;


--
-- Name: action_implementers action_implementers_action_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_implementers
    ADD CONSTRAINT action_implementers_action_id_fkey FOREIGN KEY (action_id) REFERENCES public.meeting_actions(id) ON DELETE CASCADE;


--
-- Name: action_implementers action_implementers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_implementers
    ADD CONSTRAINT action_implementers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: action_status_history action_status_history_action_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_status_history
    ADD CONSTRAINT action_status_history_action_id_fkey FOREIGN KEY (action_id) REFERENCES public.meeting_actions(id) ON DELETE CASCADE;


--
-- Name: action_status_history action_status_history_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_status_history
    ADD CONSTRAINT action_status_history_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: action_status_history action_status_history_individual_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_status_history
    ADD CONSTRAINT action_status_history_individual_status_id_fkey FOREIGN KEY (individual_status_id) REFERENCES public.action_statuses(id) ON DELETE SET NULL;


--
-- Name: action_status_history action_status_history_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_status_history
    ADD CONSTRAINT action_status_history_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: action_statuses action_statuses_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_statuses
    ADD CONSTRAINT action_statuses_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: action_statuses action_statuses_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_statuses
    ADD CONSTRAINT action_statuses_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attribute_groups attribute_groups_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attribute_groups
    ADD CONSTRAINT attribute_groups_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attribute_groups attribute_groups_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attribute_groups
    ADD CONSTRAINT attribute_groups_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attribute_values attribute_values_attribute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attribute_values
    ADD CONSTRAINT attribute_values_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES public.attributes(id) ON DELETE CASCADE;


--
-- Name: attribute_values attribute_values_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attribute_values
    ADD CONSTRAINT attribute_values_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attribute_values attribute_values_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attribute_values
    ADD CONSTRAINT attribute_values_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attributes attributes_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attributes
    ADD CONSTRAINT attributes_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attributes attributes_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attributes
    ADD CONSTRAINT attributes_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.attribute_groups(id) ON DELETE CASCADE;


--
-- Name: attributes attributes_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attributes
    ADD CONSTRAINT attributes_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: entity_attributes entity_attributes_attribute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_attributes
    ADD CONSTRAINT entity_attributes_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES public.attributes(id) ON DELETE CASCADE;


--
-- Name: entity_attributes entity_attributes_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_attributes
    ADD CONSTRAINT entity_attributes_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: entity_attributes entity_attributes_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_attributes
    ADD CONSTRAINT entity_attributes_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: locations locations_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.locations(id) ON DELETE CASCADE;


--
-- Name: meeting_actions meeting_actions_assign_to_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_actions
    ADD CONSTRAINT meeting_actions_assign_to_meeting_id_fkey FOREIGN KEY (assign_to_meeting_id) REFERENCES public.meetings(id) ON DELETE SET NULL;


--
-- Name: meeting_actions meeting_actions_assigned_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_actions
    ADD CONSTRAINT meeting_actions_assigned_by_id_fkey FOREIGN KEY (assigned_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: meeting_actions meeting_actions_assigned_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_actions
    ADD CONSTRAINT meeting_actions_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: meeting_actions meeting_actions_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_actions
    ADD CONSTRAINT meeting_actions_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: meeting_actions meeting_actions_minute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_actions
    ADD CONSTRAINT meeting_actions_minute_id_fkey FOREIGN KEY (minute_id) REFERENCES public.meeting_minutes(id) ON DELETE CASCADE;


--
-- Name: meeting_actions meeting_actions_overall_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_actions
    ADD CONSTRAINT meeting_actions_overall_status_id_fkey FOREIGN KEY (overall_status_id) REFERENCES public.action_statuses(id) ON DELETE SET NULL;


--
-- Name: meeting_actions meeting_actions_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_actions
    ADD CONSTRAINT meeting_actions_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: meeting_documents meeting_documents_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_documents
    ADD CONSTRAINT meeting_documents_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: meeting_documents meeting_documents_document_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_documents
    ADD CONSTRAINT meeting_documents_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES public.attributes(id) ON DELETE SET NULL;


--
-- Name: meeting_documents meeting_documents_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_documents
    ADD CONSTRAINT meeting_documents_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE CASCADE;


--
-- Name: meeting_documents meeting_documents_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_documents
    ADD CONSTRAINT meeting_documents_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: meeting_documents meeting_documents_uploaded_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_documents
    ADD CONSTRAINT meeting_documents_uploaded_by_id_fkey FOREIGN KEY (uploaded_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: meeting_minutes meeting_minutes_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_minutes
    ADD CONSTRAINT meeting_minutes_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: meeting_minutes meeting_minutes_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_minutes
    ADD CONSTRAINT meeting_minutes_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE CASCADE;


--
-- Name: meeting_minutes meeting_minutes_recorded_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_minutes
    ADD CONSTRAINT meeting_minutes_recorded_by_id_fkey FOREIGN KEY (recorded_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: meeting_minutes meeting_minutes_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_minutes
    ADD CONSTRAINT meeting_minutes_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: meeting_participants meeting_participants_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_participants
    ADD CONSTRAINT meeting_participants_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: meeting_participants meeting_participants_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_participants
    ADD CONSTRAINT meeting_participants_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE CASCADE;


--
-- Name: meeting_participants meeting_participants_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_participants
    ADD CONSTRAINT meeting_participants_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: meeting_status_history meeting_status_history_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_status_history
    ADD CONSTRAINT meeting_status_history_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: meeting_status_history meeting_status_history_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_status_history
    ADD CONSTRAINT meeting_status_history_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id);


--
-- Name: meeting_status_history meeting_status_history_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_status_history
    ADD CONSTRAINT meeting_status_history_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.attributes(id);


--
-- Name: meeting_status_history meeting_status_history_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_status_history
    ADD CONSTRAINT meeting_status_history_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id);


--
-- Name: meetings meetings_chairperson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_chairperson_id_fkey FOREIGN KEY (chairperson_id) REFERENCES public.meeting_participants(id) ON DELETE SET NULL;


--
-- Name: meetings meetings_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: meetings meetings_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.organization_nodes(id);


--
-- Name: meetings meetings_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: meetings meetings_recurring_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_recurring_meeting_id_fkey FOREIGN KEY (recurring_meeting_id) REFERENCES public.recurring_meetings(id) ON DELETE SET NULL;


--
-- Name: meetings meetings_restricted_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_restricted_department_id_fkey FOREIGN KEY (restricted_department_id) REFERENCES public.organization_nodes(id);


--
-- Name: meetings meetings_secretary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_secretary_id_fkey FOREIGN KEY (secretary_id) REFERENCES public.meeting_participants(id) ON DELETE SET NULL;


--
-- Name: meetings meetings_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.attributes(id) ON DELETE SET NULL;


--
-- Name: meetings meetings_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: menus menus_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menus
    ADD CONSTRAINT menus_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.menus(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.meeting_participants(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: organization_nodes organization_nodes_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_nodes
    ADD CONSTRAINT organization_nodes_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.organization_nodes(id) ON DELETE CASCADE;


--
-- Name: participant_list_members participant_list_members_added_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participant_list_members
    ADD CONSTRAINT participant_list_members_added_by_id_fkey FOREIGN KEY (added_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: participant_list_members participant_list_members_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participant_list_members
    ADD CONSTRAINT participant_list_members_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE;


--
-- Name: participant_list_members participant_list_members_participant_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participant_list_members
    ADD CONSTRAINT participant_list_members_participant_list_id_fkey FOREIGN KEY (participant_list_id) REFERENCES public.participant_lists(id) ON DELETE CASCADE;


--
-- Name: participant_lists participant_lists_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participant_lists
    ADD CONSTRAINT participant_lists_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: participant_lists participant_lists_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participant_lists
    ADD CONSTRAINT participant_lists_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: participants participants_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: participants participants_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: recurring_meeting_occurrences recurring_meeting_occurrences_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_meeting_occurrences
    ADD CONSTRAINT recurring_meeting_occurrences_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE CASCADE;


--
-- Name: recurring_meeting_occurrences recurring_meeting_occurrences_recurring_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_meeting_occurrences
    ADD CONSTRAINT recurring_meeting_occurrences_recurring_meeting_id_fkey FOREIGN KEY (recurring_meeting_id) REFERENCES public.recurring_meetings(id) ON DELETE CASCADE;


--
-- Name: recurring_meetings recurring_meetings_chairperson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_meetings
    ADD CONSTRAINT recurring_meetings_chairperson_id_fkey FOREIGN KEY (chairperson_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: recurring_meetings recurring_meetings_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_meetings
    ADD CONSTRAINT recurring_meetings_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: recurring_meetings recurring_meetings_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_meetings
    ADD CONSTRAINT recurring_meetings_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.organization_nodes(id) ON DELETE SET NULL;


--
-- Name: recurring_meetings recurring_meetings_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_meetings
    ADD CONSTRAINT recurring_meetings_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: recurring_meetings recurring_meetings_meeting_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_meetings
    ADD CONSTRAINT recurring_meetings_meeting_template_id_fkey FOREIGN KEY (meeting_template_id) REFERENCES public.meetings(id) ON DELETE SET NULL;


--
-- Name: recurring_meetings recurring_meetings_recurrence_day_of_week_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_meetings
    ADD CONSTRAINT recurring_meetings_recurrence_day_of_week_id_fkey FOREIGN KEY (recurrence_day_of_week_id) REFERENCES public.attributes(id) ON DELETE RESTRICT;


--
-- Name: recurring_meetings recurring_meetings_recurrence_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_meetings
    ADD CONSTRAINT recurring_meetings_recurrence_type_id_fkey FOREIGN KEY (recurrence_type_id) REFERENCES public.attributes(id) ON DELETE RESTRICT;


--
-- Name: recurring_meetings recurring_meetings_recurrence_week_of_month_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_meetings
    ADD CONSTRAINT recurring_meetings_recurrence_week_of_month_id_fkey FOREIGN KEY (recurrence_week_of_month_id) REFERENCES public.attributes(id) ON DELETE RESTRICT;


--
-- Name: recurring_meetings recurring_meetings_restricted_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_meetings
    ADD CONSTRAINT recurring_meetings_restricted_department_id_fkey FOREIGN KEY (restricted_department_id) REFERENCES public.organization_nodes(id) ON DELETE SET NULL;


--
-- Name: recurring_meetings recurring_meetings_secretary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_meetings
    ADD CONSTRAINT recurring_meetings_secretary_id_fkey FOREIGN KEY (secretary_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: recurring_meetings recurring_meetings_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_meetings
    ADD CONSTRAINT recurring_meetings_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.attributes(id) ON DELETE RESTRICT;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: role_menu_permissions role_menu_permissions_menu_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_menu_permissions
    ADD CONSTRAINT role_menu_permissions_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES public.menus(id) ON DELETE CASCADE;


--
-- Name: role_menu_permissions role_menu_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_menu_permissions
    ADD CONSTRAINT role_menu_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_attributes user_attributes_attribute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_attributes
    ADD CONSTRAINT user_attributes_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES public.attributes(id) ON DELETE CASCADE;


--
-- Name: user_attributes user_attributes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_attributes
    ADD CONSTRAINT user_attributes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_departments user_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_departments
    ADD CONSTRAINT user_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.organization_nodes(id) ON DELETE CASCADE;


--
-- Name: user_departments user_departments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_departments
    ADD CONSTRAINT user_departments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_country_attribute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_country_attribute_id_fkey FOREIGN KEY (country_attribute_id) REFERENCES public.attributes(id) ON DELETE SET NULL;


--
-- Name: users users_currency_attribute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_currency_attribute_id_fkey FOREIGN KEY (currency_attribute_id) REFERENCES public.attributes(id) ON DELETE SET NULL;


--
-- Name: users users_gender_attribute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_gender_attribute_id_fkey FOREIGN KEY (gender_attribute_id) REFERENCES public.attributes(id) ON DELETE SET NULL;


--
-- Name: users users_language_attribute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_language_attribute_id_fkey FOREIGN KEY (language_attribute_id) REFERENCES public.attributes(id) ON DELETE SET NULL;


--
-- Name: users users_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: users users_nationality_attribute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_nationality_attribute_id_fkey FOREIGN KEY (nationality_attribute_id) REFERENCES public.attributes(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict rxJJKJBtggfxVdTF51eJx4aGcSeXh8GK6hNJdLg7GvyMWjqVQjYPQKsOEyxMcgV

