// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/avatar-voice/v1
//
// Every exported `<Stem>` type is a best-effort structural sketch for editor
// ergonomics only. Keywords that constrain values without changing shape
// (if/then/else, allOf, not, dependentRequired, pattern, format, min/max,
// multipleOf) are enforced by `read()` against SCHEMAS below, not by these
// static types -- a value can satisfy a type here and still be rejected by
// `read()`. Treat `read()` as authoritative.

import { ContractPackageReader } from "./runtime.generated";

export const SCHEMAS = {
  "avatar-binding-snapshot.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/avatar-voice/v1/avatar-binding-snapshot.schema.json",
    "title": "avatar_binding_snapshot_v1",
    "description": "Owner-resolved snapshot of one avatar binding of a job (P04-06): the ready avatar at its owner version, the exact look image and ordered identity reference images (completed shots, Storage object + checksum), the owner-resolved voice (ready profile, language it supports, ready route candidates) and the access scope the owners verified. It carries ids, versions and checksums only: never a file name, URL, provider voice id or provider avatar id. The exact TTS route is pinned at launch by the Voice owner.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "avatar",
      "look",
      "references",
      "voice",
      "access",
      "resolved_at"
    ],
    "properties": {
      "schema_version": {
        "const": "avatar_binding_snapshot_v1"
      },
      "avatar": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "avatar_id",
          "avatar_version",
          "origin",
          "channel_id"
        ],
        "properties": {
          "avatar_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "avatar_version": {
            "type": "integer",
            "minimum": 0
          },
          "origin": {
            "enum": [
              "human_clone",
              "digital_human",
              "public_template"
            ]
          },
          "channel_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "look": {
        "$ref": "#/$defs/ShotRef"
      },
      "references": {
        "description": "Other completed shots of the same avatar usable as identity references, primary first then newest; never includes the look itself.",
        "type": "array",
        "maxItems": 8,
        "items": {
          "$ref": "#/$defs/ShotRef"
        }
      },
      "voice": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "voice_profile_id",
              "voice_version",
              "origin",
              "language",
              "ready_route_count"
            ],
            "properties": {
              "voice_profile_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              },
              "voice_version": {
                "type": "integer",
                "minimum": 0
              },
              "origin": {
                "type": "string",
                "pattern": "^[a-z][a-z0-9_]{0,31}$"
              },
              "language": {
                "$ref": "common.schema.json#/$defs/Language"
              },
              "ready_route_count": {
                "type": "integer",
                "minimum": 1,
                "maximum": 64
              }
            }
          }
        ]
      },
      "access": {
        "description": "The scope the owners verified (existing Avatar/Voice owner access rules, unchanged by Q23).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "avatar_scope",
          "voice_scope"
        ],
        "properties": {
          "avatar_scope": {
            "const": "channel"
          },
          "voice_scope": {
            "enum": [
              "channel",
              "tenant",
              "none"
            ]
          }
        }
      },
      "resolved_at": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      }
    },
    "$defs": {
      "ShotRef": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "shot_id",
          "shot_version",
          "storage_object"
        ],
        "properties": {
          "shot_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "shot_version": {
            "type": "integer",
            "minimum": 0
          },
          "storage_object": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/StorageObjectRef"
          }
        }
      }
    }
  },
  "avatar-presenter-capabilities.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/avatar-voice/v1/avatar-presenter-capabilities.schema.json",
    "title": "avatar_presenter_capabilities_v1",
    "description": "What one exact Provider catalog model can do for `avatar.present` (presenter generation / lip-sync), declared in `resolved_model_config.avatar_presenter_capabilities`. A model without it cannot present an avatar; a video generation declaration never implies it. The look-image range is what the adapter really sends: a path that uses only one image declares max_count 1, never more. A declaration never exceeds its runtime adapter's presenter features (avatar-voice-rules.json `presenter_adapter_features`).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "operation",
      "look_images",
      "speech_sources",
      "lip_sync",
      "languages",
      "duration",
      "aspect_ratios",
      "resolution",
      "background_modes",
      "cancellation",
      "provider_concurrency"
    ],
    "properties": {
      "schema_version": {
        "const": "avatar_presenter_capabilities_v1"
      },
      "operation": {
        "const": "avatar.present"
      },
      "look_images": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "min_count",
          "max_count"
        ],
        "properties": {
          "min_count": {
            "type": "integer",
            "minimum": 1,
            "maximum": 8
          },
          "max_count": {
            "type": "integer",
            "minimum": 1,
            "maximum": 8
          }
        }
      },
      "speech_sources": {
        "type": "array",
        "minItems": 1,
        "maxItems": 2,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/SpeechSource"
        }
      },
      "lip_sync": {
        "type": "boolean"
      },
      "languages": {
        "description": "Script languages of provider_voice_script (empty when the model has no provider voice). An audio_track is language-agnostic for the model; its language comes from the owner-resolved voice.",
        "type": "array",
        "maxItems": 64,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/Language"
        }
      },
      "duration": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "max_seconds"
        ],
        "properties": {
          "max_seconds": {
            "type": "integer",
            "minimum": 1,
            "maximum": 600
          }
        }
      },
      "aspect_ratios": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "options",
          "follows_look_image"
        ],
        "properties": {
          "options": {
            "type": "array",
            "minItems": 1,
            "maxItems": 8,
            "uniqueItems": true,
            "items": {
              "$ref": "common.schema.json#/$defs/AspectRatio"
            }
          },
          "follows_look_image": {
            "description": "true when the output takes its geometry from the look image (the requested ratio is then a notice; the caller crops the look first).",
            "type": "boolean"
          }
        }
      },
      "resolution": {
        "description": "selectable false = provider-defined output resolution (Spark normalizes it); an explicitly requested resolution is then resolution_unsupported.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "selectable",
          "options"
        ],
        "properties": {
          "selectable": {
            "type": "boolean"
          },
          "options": {
            "type": "array",
            "maxItems": 8,
            "uniqueItems": true,
            "items": {
              "type": "string",
              "pattern": "^(?:[1-9][0-9]{2,3}p|[1-8]K)$"
            }
          }
        }
      },
      "background_modes": {
        "type": "array",
        "minItems": 1,
        "maxItems": 4,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/BackgroundMode"
        }
      },
      "cancellation": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "provider_cancel"
        ],
        "properties": {
          "provider_cancel": {
            "enum": [
              "none",
              "queued_only",
              "any_state"
            ]
          }
        }
      },
      "provider_concurrency": {
        "description": "Declared vendor concurrency (informational; never exposed publicly).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "max_concurrent_jobs",
          "scope"
        ],
        "properties": {
          "max_concurrent_jobs": {
            "oneOf": [
              {
                "type": "integer",
                "minimum": 1,
                "maximum": 10000
              },
              {
                "type": "null"
              }
            ]
          },
          "scope": {
            "enum": [
              "model",
              "provider_account",
              "unknown"
            ]
          }
        }
      }
    }
  },
  "avatar-usage-capability-report.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/avatar-voice/v1/avatar-usage-capability-report.schema.json",
    "title": "avatar_usage_capability_report_v1",
    "description": "Result of validating one avatar_usage_request_v1 against one exact model. `unsupported` when any issue is an error (no silent input drop, no silent model change). Issues follow avatar-voice-rules.json `issue_order` and never carry provider names, URLs or scripts.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "usage",
      "verdict",
      "issues"
    ],
    "properties": {
      "schema_version": {
        "const": "avatar_usage_capability_report_v1"
      },
      "usage": {
        "$ref": "common.schema.json#/$defs/AvatarUsage"
      },
      "verdict": {
        "enum": [
          "supported",
          "unsupported"
        ]
      },
      "issues": {
        "type": "array",
        "maxItems": 32,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "code",
            "field",
            "severity"
          ],
          "properties": {
            "code": {
              "$ref": "common.schema.json#/$defs/IssueCode"
            },
            "field": {
              "$ref": "common.schema.json#/$defs/CapabilityField"
            },
            "severity": {
              "$ref": "common.schema.json#/$defs/IssueSeverity"
            }
          }
        }
      }
    }
  },
  "avatar-usage-request.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/avatar-voice/v1/avatar-usage-request.schema.json",
    "title": "avatar_usage_request_v1",
    "description": "The capability point of one avatar usage against one exact model: presenter (look image count, speech source, language, duration, ratio, resolution, background) or scene reference (how many identity images the scene should really use, and whether the target is video or image generation). Counts and flags only; no URL, id or script.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "usage",
      "scene_target",
      "image_count",
      "speech_source",
      "voice_resolved",
      "language",
      "duration_seconds",
      "aspect_ratio",
      "resolution",
      "background_mode"
    ],
    "properties": {
      "schema_version": {
        "const": "avatar_usage_request_v1"
      },
      "usage": {
        "$ref": "common.schema.json#/$defs/AvatarUsage"
      },
      "scene_target": {
        "description": "scene_reference only: the generation capability the scene uses; null for presenter.",
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/SceneTarget"
          },
          {
            "type": "null"
          }
        ]
      },
      "image_count": {
        "description": "presenter: look images sent; scene_reference: identity images the scene must use (all of them, never only the first).",
        "type": "integer",
        "minimum": 1,
        "maximum": 9
      },
      "speech_source": {
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/SpeechSource"
          },
          {
            "type": "null"
          }
        ]
      },
      "voice_resolved": {
        "description": "An owner-resolved voice is bound (needed for an audio_track).",
        "type": "boolean"
      },
      "language": {
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/Language"
          },
          {
            "type": "null"
          }
        ]
      },
      "duration_seconds": {
        "oneOf": [
          {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 3600
          },
          {
            "type": "null"
          }
        ]
      },
      "aspect_ratio": {
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/AspectRatio"
          },
          {
            "type": "null"
          }
        ]
      },
      "resolution": {
        "oneOf": [
          {
            "type": "string",
            "pattern": "^(?:[1-9][0-9]{2,3}p|[1-8]K)$"
          },
          {
            "type": "null"
          }
        ]
      },
      "background_mode": {
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/BackgroundMode"
          },
          {
            "type": "null"
          }
        ]
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "usage": {
              "const": "presenter"
            }
          }
        },
        "then": {
          "properties": {
            "scene_target": {
              "type": "null"
            }
          }
        },
        "else": {
          "properties": {
            "scene_target": {
              "$ref": "common.schema.json#/$defs/SceneTarget"
            }
          }
        }
      }
    ]
  },
  "common.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/avatar-voice/v1/common.schema.json",
    "title": "avatar_voice_common_v1",
    "description": "Shared definitions of the avatar-voice v1 package (P04-06). Two separate capabilities: `avatar.present` (presenter generation / lip-sync of an avatar look speaking) and scene identity reference (an avatar's look images guiding a generated scene, answered by the model's generation declaration). Neither is inferred from the other or from a model name.",
    "$defs": {
      "AvatarUsage": {
        "description": "presenter = the avatar speaks (talking head / lip-sync); scene_reference = the avatar's identity is referenced inside a generated scene.",
        "enum": [
          "presenter",
          "scene_reference"
        ]
      },
      "SpeechSource": {
        "description": "audio_track = a speech audio Youtorch produced with the owner-resolved voice (the model lip-syncs to it); provider_voice_script = the provider speaks a script with its own voice.",
        "enum": [
          "audio_track",
          "provider_voice_script"
        ]
      },
      "BackgroundMode": {
        "description": "keep = the look's own background; remove / color / image = the generation parameter path (P06-49 `generation_param`, K291a).",
        "enum": [
          "keep",
          "remove",
          "color",
          "image"
        ]
      },
      "SceneTarget": {
        "enum": [
          "video.generate",
          "image.generate"
        ]
      },
      "AspectRatio": {
        "type": "string",
        "pattern": "^[1-9][0-9]?:[1-9][0-9]?$"
      },
      "Language": {
        "description": "Canonical lower-case language tag as the Voice owner normalizes it (tr, en-us).",
        "type": "string",
        "pattern": "^[a-z]{2,8}(?:-[a-z0-9]{1,8}){0,3}$"
      },
      "CapabilityField": {
        "enum": [
          "capability",
          "usage",
          "look_images",
          "reference_images",
          "speech_source",
          "lip_sync",
          "language",
          "duration",
          "aspect_ratio",
          "resolution",
          "background",
          "voice"
        ]
      },
      "IssueSeverity": {
        "enum": [
          "error",
          "notice"
        ]
      },
      "IssueCode": {
        "enum": [
          "capability_undeclared",
          "capability_invalid",
          "usage_unsupported",
          "look_image_count_unsupported",
          "reference_images_unsupported",
          "reference_images_exceed_limit",
          "speech_source_required",
          "speech_source_unsupported",
          "lip_sync_unsupported",
          "voice_required",
          "language_unsupported",
          "duration_exceeds_limit",
          "aspect_ratio_unsupported",
          "aspect_ratio_follows_look_image",
          "resolution_unsupported",
          "background_mode_unsupported"
        ]
      }
    }
  }
} as const;

// Foreign schema files reached through cross-package $refs, embedded verbatim
// from their owner package and registered next to SCHEMAS.
export const DEPENDENCY_SCHEMAS = {
  "assistant-runtime/v1/common.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json",
    "title": "assistant_runtime_common_v1",
    "description": "Shared scalar and enum definitions for the assistant-runtime v1 package. Not a standalone document type.",
    "$defs": {
      "OpaqueId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
      },
      "EnvelopeId": {
        "description": "Billing spend envelope id; format owned by P00-10 (spend-envelope v1), mirrored here until cross-package $ref is allowed after Wave 0.",
        "type": "string",
        "pattern": "^env_[A-Za-z0-9_-]{3,64}$"
      },
      "AllocationId": {
        "description": "Billing allocation id; format owned by P00-10 (spend-envelope v1), mirrored here until cross-package $ref is allowed after Wave 0.",
        "type": "string",
        "pattern": "^alc_[A-Za-z0-9_-]{3,64}$"
      },
      "CompositionProjectId": {
        "description": "Composition project id of the Spark project entry (PR #294): private, tenant + owner scoped, cprj_<uuid>. P00-07 scope-grants and P00-10 use the same format.",
        "type": "string",
        "pattern": "^cprj_[0-9a-f-]{36}$"
      },
      "ModelId": {
        "description": "Public model catalog id (same shape as the current AssistantModelIdSchema).",
        "type": "string",
        "pattern": "^[A-Za-z0-9._:-]{1,128}$"
      },
      "CapabilityKey": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
        "maxLength": 128
      },
      "Sha256": {
        "type": "string",
        "pattern": "^[a-f0-9]{64}$"
      },
      "Version": {
        "description": "Monotonic owner version counter used for CAS.",
        "type": "integer",
        "minimum": 0
      },
      "Revision": {
        "description": "Immutable revision number; the first revision is 1.",
        "type": "integer",
        "minimum": 1
      },
      "Generation": {
        "description": "P00-07 scope/grant generation of a source resource (scope-grants v1 Generation): every change of who may read the source increments it.",
        "type": "integer",
        "minimum": 1
      },
      "Visibility": {
        "description": "P00-07 resource visibility (scope-grants v1 Visibility): private = owner only, shared = owner + explicit grants.",
        "enum": [
          "private",
          "shared"
        ]
      },
      "EventSequence": {
        "description": "Durable conversation/run event ordinal (P01-15 cursor), never a wall-clock cutoff.",
        "type": "integer",
        "minimum": 0
      },
      "Timestamp": {
        "type": "string",
        "format": "date-time"
      },
      "Surface": {
        "description": "Client surface that produced the message. Surface context never grants authority. `motion_authoring` (E1-H, additive v1) is the Motion screen's chat of one private Motion draft.",
        "enum": [
          "dashboard_chat",
          "spark_chat",
          "workflow_authoring",
          "motion_authoring"
        ]
      },
      "Mode": {
        "description": "Canonical execution mode name (KARAR-PLAN-QA-KAPANIS \u00a74, Q24/Q74). Legacy approval_mode=autonomous normalizes to auto. The mode/grant model itself is owned by P00-13 assistant schemas and P00-11.",
        "enum": [
          "ask",
          "auto",
          "auto_full"
        ]
      },
      "Channel": {
        "description": "Invocation channel; maps 1:1 to the P00-10 funding_channel value (TK-15).",
        "enum": [
          "app",
          "api",
          "mcp"
        ]
      },
      "JobStatus": {
        "description": "Normative owner-projection job_status (KARAR-PLAN-QA-KAPANIS \u00a73 + TK-03). waiting_input is the only input-wait status name (Q78); forbidden spellings are listed in field-dictionary.json.",
        "enum": [
          "draft",
          "preparing",
          "waiting_input",
          "plan_ready",
          "awaiting_g1",
          "funding_required",
          "admitted",
          "queued",
          "producing",
          "partial",
          "preview_ready",
          "awaiting_g2",
          "rendering",
          "completed",
          "failed",
          "canceled",
          "rejected",
          "expired"
        ]
      },
      "AttentionFlag": {
        "description": "Typed attention flags, separate from job_status (TK-03). funding_required is a job_status, not a flag.",
        "enum": [
          "sync_required",
          "fallback_used",
          "needs_connection",
          "unsupported_script",
          "admin_review"
        ]
      },
      "ApiFamily": {
        "description": "Provider protocol family of a native serializer (KARAR-COKLU-MODEL \u00a76).",
        "enum": [
          "openai_responses",
          "openai_chat_completions_compatible",
          "gemini_interactions",
          "gemini_generate_content",
          "anthropic_messages"
        ]
      },
      "OwnerBc": {
        "enum": [
          "assistant",
          "avatar",
          "billing",
          "brand",
          "composition",
          "connector",
          "memory",
          "provider",
          "review",
          "storage",
          "voice",
          "workflow"
        ]
      }
    }
  },
  "assistant-runtime/v1/owner-refs.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json",
    "title": "owner_ref_v1",
    "description": "Typed owner-specific reference union (MIMARI \u00a75.3). Each ref names its owner's own immutable version field; there is no universal revision_id. A visible label is never the identity or an authority; the owner resolver re-validates access on every dispatch. P00-03 owns these field names; P00-07 scope-grants and later packages reuse them (coordinator decision 26 Sep 2026).",
    "oneOf": [
      {
        "$ref": "#/$defs/SkillRevisionRef"
      },
      {
        "$ref": "#/$defs/CapabilityRef"
      },
      {
        "$ref": "#/$defs/ConnectorToolRef"
      },
      {
        "$ref": "#/$defs/ConnectedAccountRef"
      },
      {
        "$ref": "#/$defs/BrandRevisionRef"
      },
      {
        "$ref": "#/$defs/StorageObjectRef"
      },
      {
        "$ref": "#/$defs/ModelCatalogRef"
      },
      {
        "$ref": "#/$defs/AvatarRef"
      },
      {
        "$ref": "#/$defs/VoiceProfileRef"
      }
    ],
    "$defs": {
      "SkillRevisionRef": {
        "description": "Assistant-owned skill revision pinned by revision + body digest (MIMARI \u00a73). Owner: Assistant (P01D catalog).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "skill_id",
          "skill_revision_id",
          "skill_scope",
          "body_digest_sha256"
        ],
        "properties": {
          "ref_type": {
            "const": "skill_revision"
          },
          "skill_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "skill_revision_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "skill_scope": {
            "enum": [
              "system_internal",
              "platform",
              "workspace",
              "personal"
            ]
          },
          "body_digest_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          }
        }
      },
      "CapabilityRef": {
        "description": "Abstract capability requirement. Carries no OAuth scope, credential, vendor tool id, mode or credit authority; the owning BC resolves it.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "capability_key",
          "owner_bc"
        ],
        "properties": {
          "ref_type": {
            "const": "capability"
          },
          "capability_key": {
            "$ref": "common.schema.json#/$defs/CapabilityKey"
          },
          "owner_bc": {
            "$ref": "common.schema.json#/$defs/OwnerBc"
          },
          "capability_revision": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "ConnectorToolRef": {
        "description": "Exact Connector tool revision. Remote metadata revision is not an execution pin (R03). Owner: Connector (P01C-24 refines field names after Wave 0).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "connector_definition_id",
          "tool_name",
          "tool_revision_id"
        ],
        "properties": {
          "ref_type": {
            "const": "connector_tool"
          },
          "connector_definition_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "tool_name": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_-]*(\\.[a-z][a-z0-9_-]*)+$",
            "maxLength": 128
          },
          "tool_revision_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "ConnectedAccountRef": {
        "description": "Connected account (connection) reference. Secret-free: no token, scope or grant; ConnectionGrant is checked by Connector at dispatch.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "connector_definition_id",
          "connection_id",
          "connection_revision"
        ],
        "properties": {
          "ref_type": {
            "const": "connected_account"
          },
          "connector_definition_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "connection_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "connection_revision": {
            "$ref": "common.schema.json#/$defs/Version"
          }
        }
      },
      "BrandRevisionRef": {
        "description": "Brand immutable revision of a Kit/Element/Template/Motion definition, pinned by revision id + revision digest (P00-07 dependency pinning uses these names). Owner: Brand.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "brand_asset_kind",
          "brand_asset_id",
          "brand_revision_id",
          "brand_revision_digest_sha256"
        ],
        "properties": {
          "ref_type": {
            "const": "brand_revision"
          },
          "brand_asset_kind": {
            "enum": [
              "kit",
              "element",
              "template",
              "motion"
            ]
          },
          "brand_asset_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "brand_revision_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "brand_revision_digest_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          }
        }
      },
      "StorageObjectRef": {
        "description": "Storage object + checksum. A signed URL or file name is never a reference. Owner: Storage.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "storage_object_id",
          "checksum_sha256"
        ],
        "properties": {
          "ref_type": {
            "const": "storage_object"
          },
          "storage_object_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "checksum_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          },
          "media_kind": {
            "enum": [
              "video",
              "image",
              "audio",
              "document",
              "other"
            ]
          },
          "byte_size": {
            "type": "integer",
            "minimum": 0
          }
        }
      },
      "ModelCatalogRef": {
        "description": "Provider model catalog entry + capability revision. A client label or public alias alone is not the effective model.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "model_id",
          "model_catalog_revision",
          "capability_key",
          "capability_revision"
        ],
        "properties": {
          "ref_type": {
            "const": "model_catalog"
          },
          "model_id": {
            "$ref": "common.schema.json#/$defs/ModelId"
          },
          "model_catalog_revision": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "capability_key": {
            "$ref": "common.schema.json#/$defs/CapabilityKey"
          },
          "capability_revision": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "AvatarRef": {
        "description": "Existing Avatar owner version (+ optional execution snapshot pinned by the owner at execution). No avatar_revision_id is invented.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "avatar_id",
          "avatar_version"
        ],
        "properties": {
          "ref_type": {
            "const": "avatar"
          },
          "avatar_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "avatar_version": {
            "$ref": "common.schema.json#/$defs/Version"
          },
          "execution_snapshot_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "execution_snapshot_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          }
        },
        "dependentRequired": {
          "execution_snapshot_id": [
            "execution_snapshot_sha256"
          ],
          "execution_snapshot_sha256": [
            "execution_snapshot_id"
          ]
        }
      },
      "VoiceProfileRef": {
        "description": "Existing Voice profile owner version (+ optional execution snapshot of the resolved binding route).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "voice_profile_id",
          "voice_profile_version"
        ],
        "properties": {
          "ref_type": {
            "const": "voice_profile"
          },
          "voice_profile_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "voice_profile_version": {
            "$ref": "common.schema.json#/$defs/Version"
          },
          "execution_snapshot_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "execution_snapshot_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          }
        },
        "dependentRequired": {
          "execution_snapshot_id": [
            "execution_snapshot_sha256"
          ],
          "execution_snapshot_sha256": [
            "execution_snapshot_id"
          ]
        }
      },
      "InvocationTargetRef": {
        "description": "What a tool invocation targets: an internal owner capability or an exact Connector tool revision.",
        "oneOf": [
          {
            "$ref": "#/$defs/CapabilityRef"
          },
          {
            "$ref": "#/$defs/ConnectorToolRef"
          }
        ]
      }
    }
  }
} as const;

export const DOCUMENT_TYPES = ["avatar-binding-snapshot", "avatar-presenter-capabilities", "avatar-usage-capability-report", "avatar-usage-request"] as const;
export type DocumentType = "avatar-binding-snapshot" | "avatar-presenter-capabilities" | "avatar-usage-capability-report" | "avatar-usage-request";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "avatar-binding-snapshot": [
    "avatar_binding_snapshot_v1"
  ],
  "avatar-presenter-capabilities": [
    "avatar_presenter_capabilities_v1"
  ],
  "avatar-usage-capability-report": [
    "avatar_usage_capability_report_v1"
  ],
  "avatar-usage-request": [
    "avatar_usage_request_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {};

export type AvatarBindingSnapshot = {
    readonly "schema_version": "avatar_binding_snapshot_v1";
    readonly "avatar": {
    readonly "avatar_id": unknown;
    readonly "avatar_version": number;
    readonly "origin": "human_clone" | "digital_human" | "public_template";
    readonly "channel_id": unknown;
  };
    readonly "look": unknown;
    readonly "references": readonly (unknown)[];
    readonly "voice": (null) | ({
    readonly "voice_profile_id": unknown;
    readonly "voice_version": number;
    readonly "origin": string;
    readonly "language": string;
    readonly "ready_route_count": number;
  });
    readonly "access": {
    readonly "avatar_scope": "channel";
    readonly "voice_scope": "channel" | "tenant" | "none";
  };
    readonly "resolved_at": unknown;
  };
export type AvatarPresenterCapabilities = {
    readonly "schema_version": "avatar_presenter_capabilities_v1";
    readonly "operation": "avatar.present";
    readonly "look_images": {
    readonly "min_count": number;
    readonly "max_count": number;
  };
    readonly "speech_sources": readonly ("audio_track" | "provider_voice_script")[];
    readonly "lip_sync": boolean;
    readonly "languages": readonly (string)[];
    readonly "duration": {
    readonly "max_seconds": number;
  };
    readonly "aspect_ratios": {
    readonly "options": readonly (string)[];
    readonly "follows_look_image": boolean;
  };
    readonly "resolution": {
    readonly "selectable": boolean;
    readonly "options": readonly (string)[];
  };
    readonly "background_modes": readonly ("keep" | "remove" | "color" | "image")[];
    readonly "cancellation": {
    readonly "provider_cancel": "none" | "queued_only" | "any_state";
  };
    readonly "provider_concurrency": {
    readonly "max_concurrent_jobs": (number) | (null);
    readonly "scope": "model" | "provider_account" | "unknown";
  };
  };
export type AvatarUsageCapabilityReport = {
    readonly "schema_version": "avatar_usage_capability_report_v1";
    readonly "usage": "presenter" | "scene_reference";
    readonly "verdict": "supported" | "unsupported";
    readonly "issues": readonly ({
    readonly "code": "capability_undeclared" | "capability_invalid" | "usage_unsupported" | "look_image_count_unsupported" | "reference_images_unsupported" | "reference_images_exceed_limit" | "speech_source_required" | "speech_source_unsupported" | "lip_sync_unsupported" | "voice_required" | "language_unsupported" | "duration_exceeds_limit" | "aspect_ratio_unsupported" | "aspect_ratio_follows_look_image" | "resolution_unsupported" | "background_mode_unsupported";
    readonly "field": "capability" | "usage" | "look_images" | "reference_images" | "speech_source" | "lip_sync" | "language" | "duration" | "aspect_ratio" | "resolution" | "background" | "voice";
    readonly "severity": "error" | "notice";
  })[];
  };
export type AvatarUsageRequest = {
    readonly "schema_version": "avatar_usage_request_v1";
    readonly "usage": "presenter" | "scene_reference";
    readonly "scene_target": ("video.generate" | "image.generate") | (null);
    readonly "image_count": number;
    readonly "speech_source": ("audio_track" | "provider_voice_script") | (null);
    readonly "voice_resolved": boolean;
    readonly "language": (string) | (null);
    readonly "duration_seconds": (number) | (null);
    readonly "aspect_ratio": (string) | (null);
    readonly "resolution": (string) | (null);
    readonly "background_mode": ("keep" | "remove" | "color" | "image") | (null);
  };

export const reader = new ContractPackageReader({
  package: "avatar-voice",
  schemas: { ...SCHEMAS, ...DEPENDENCY_SCHEMAS } as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
