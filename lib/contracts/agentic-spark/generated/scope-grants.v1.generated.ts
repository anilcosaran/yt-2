// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/scope-grants/v1
//
// Every exported `<Stem>` type is a best-effort structural sketch for editor
// ergonomics only. Keywords that constrain values without changing shape
// (if/then/else, allOf, not, dependentRequired, pattern, format, min/max,
// multipleOf) are enforced by `read()` against SCHEMAS below, not by these
// static types -- a value can satisfy a type here and still be rejected by
// `read()`. Treat `read()` as authoritative.

import { ContractPackageReader } from "./runtime.generated";

export const SCHEMAS = {
  "common.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/scope-grants/v1/common.schema.json",
    "title": "scope_grants_common_v1",
    "description": "Shared definitions for the P00-07 scope-grants package. Not a standalone document type.",
    "$defs": {
      "OpaqueId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
      },
      "CompositionProjectId": {
        "description": "Composition project id (Spark project entry, PR #294): aligned with api-gateway's newCompositionProjectId, never a generic OpaqueId.",
        "type": "string",
        "pattern": "^cprj_[0-9a-f-]{36}$"
      },
      "Timestamp": {
        "type": "string",
        "format": "date-time"
      },
      "Sha256": {
        "type": "string",
        "pattern": "^[a-f0-9]{64}$"
      },
      "Version": {
        "description": "Monotonic owner version used for CAS.",
        "type": "integer",
        "minimum": 0
      },
      "Generation": {
        "description": "Monotonic scope/grant generation. Every mutation that changes who may read bumps it; cache fills are fenced on it.",
        "type": "integer",
        "minimum": 1
      },
      "OwnerBc": {
        "enum": [
          "assistant",
          "memory",
          "composition",
          "brand",
          "storage",
          "connector",
          "avatar",
          "voice"
        ]
      },
      "ResourceType": {
        "enum": [
          "conversation",
          "memory_item",
          "personal_instruction",
          "skill_definition",
          "composition_project",
          "storage_object",
          "brand_kit",
          "brand_element",
          "brand_template",
          "motion",
          "avatar",
          "voice_profile",
          "connected_account",
          "operation_receipt",
          "job",
          "run",
          "pending_invocation",
          "review_request",
          "tool_result",
          "checkpoint"
        ]
      },
      "InheritedResourceType": {
        "description": "These resource types carry no resource_scope_v1 of their own (P00-03/P00-11 own their record shape); they inherit the visibility and scope_generation of the conversation (or other content record) they belong to. See scope-rules.json inherited_scope.",
        "enum": [
          "job",
          "run",
          "pending_invocation",
          "review_request",
          "tool_result",
          "checkpoint"
        ]
      },
      "ResourceRef": {
        "description": "Typed owner reference; the owner BC resolves it. A label or URL is never an identity.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "owner_bc",
          "resource_type",
          "resource_id"
        ],
        "properties": {
          "owner_bc": {
            "$ref": "#/$defs/OwnerBc"
          },
          "resource_type": {
            "$ref": "#/$defs/ResourceType"
          },
          "resource_id": {
            "$ref": "#/$defs/OpaqueId"
          }
        }
      },
      "Visibility": {
        "description": "private: owner only. shared: owner plus the explicit grants recorded for the resource. No other value exists (Q102: legacy scopes are out of scope).",
        "enum": [
          "private",
          "shared"
        ]
      },
      "Audience": {
        "description": "Explicit grant audience. A tenant role is never an audience. project_members always names a Composition project (cprj_ id, PR #294), never a generic OpaqueId.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "enum": [
              "user",
              "channel_members",
              "project_members"
            ]
          },
          "id": {
            "$ref": "#/$defs/OpaqueId"
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "kind": {
                  "const": "project_members"
                }
              },
              "required": [
                "kind"
              ]
            },
            "then": {
              "properties": {
                "id": {
                  "$ref": "#/$defs/CompositionProjectId"
                }
              }
            }
          }
        ]
      },
      "Permission": {
        "description": "read: list/detail/search/SSE/replay/Review/artifact/cache. use_in_context: summary and context assembly. edit: owner-defined mutation.",
        "enum": [
          "read",
          "use_in_context",
          "edit"
        ]
      }
    }
  },
  "connector-resource-grant.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/scope-grants/v1/connector-resource-grant.schema.json",
    "title": "connector_resource_grant_v1",
    "description": "Positive ConnectionGrant (KESIN PR03): the connection owner lets an explicit grantee use exact resources through exact tool revisions. OAuth consent is a separate record and never an execution grant. No wildcard resource, no secret or token; sharing an account never exposes another actor's private chat, arguments, outputs or receipts.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "grant_id",
      "tenant_id",
      "connection",
      "owner_user_id",
      "grantee",
      "resources",
      "tool_revision_ids",
      "oauth_consent_ref",
      "grant_generation",
      "created_at",
      "revoked_at"
    ],
    "properties": {
      "schema_version": {
        "const": "connector_resource_grant_v1"
      },
      "grant_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "tenant_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "connection": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "connector_definition_id",
          "connection_id",
          "connection_revision"
        ],
        "properties": {
          "connector_definition_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "connection_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "connection_revision": {
            "description": "The connection's own revision at grant time (re-auth/credential rotation); a grant does not silently follow a later connection_revision.",
            "$ref": "common.schema.json#/$defs/Generation"
          }
        }
      },
      "owner_user_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "grantee": {
        "$ref": "common.schema.json#/$defs/Audience"
      },
      "resources": {
        "description": "Exact ConnectorResourceRefs (P01C-24 owns the full ref); never a wildcard.",
        "type": "array",
        "minItems": 1,
        "maxItems": 100,
        "uniqueItems": true,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "resource_kind",
            "resource_id"
          ],
          "properties": {
            "resource_kind": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_]{0,63}$"
            },
            "resource_id": {
              "type": "string",
              "pattern": "^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$"
            }
          }
        }
      },
      "tool_revision_ids": {
        "type": "array",
        "minItems": 1,
        "maxItems": 50,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/OpaqueId"
        }
      },
      "oauth_consent_ref": {
        "description": "The consent the account owner gave to the provider; evidence only, not an execution grant.",
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "grant_generation": {
        "$ref": "common.schema.json#/$defs/Generation"
      },
      "created_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "revoked_at": {
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/Timestamp"
          },
          {
            "type": "null"
          }
        ]
      }
    }
  },
  "content-access-grant.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/scope-grants/v1/content-access-grant.schema.json",
    "title": "content_access_grant_v1",
    "description": "Explicit, positive grant from the resource owner to a user, channel members or project members. It is the only way another member reads a private/shared record; a tenant role, channel membership alone or a support role never replaces it. Revoking it bumps the resource scope generation.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "grant_id",
      "tenant_id",
      "resource",
      "grantor_user_id",
      "audience",
      "permissions",
      "grant_version",
      "created_at",
      "revoked_at"
    ],
    "properties": {
      "schema_version": {
        "const": "content_access_grant_v1"
      },
      "grant_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "tenant_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "resource": {
        "$ref": "common.schema.json#/$defs/ResourceRef"
      },
      "grantor_user_id": {
        "description": "Must be the resource owner (checked by the owner BC; see scope-rules.json grant_rules).",
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "audience": {
        "$ref": "common.schema.json#/$defs/Audience"
      },
      "permissions": {
        "type": "array",
        "minItems": 1,
        "maxItems": 3,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/Permission"
        }
      },
      "grant_version": {
        "type": "integer",
        "minimum": 1
      },
      "created_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "revoked_at": {
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/Timestamp"
          },
          {
            "type": "null"
          }
        ]
      }
    }
  },
  "dependency-pin.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/scope-grants/v1/dependency-pin.schema.json",
    "title": "dependency_pin_v1",
    "description": "A project or template revision pins each dependency in the owner's own versioning model, using the P00-03 typed owner-ref names (assistant-runtime v1 owner-refs.schema.json; replaced by a $ref after Wave 0 acceptance): Brand by opaque immutable revision id + digest; Avatar and Voice by their existing owner version (+ optional execution snapshot); Storage by object id + checksum. No universal revision_id is invented. Upgrades are explicit only: a latest pointer change never changes an open project.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "pin_id",
      "tenant_id",
      "consumer",
      "dependency",
      "pinned_at",
      "upgrade"
    ],
    "properties": {
      "schema_version": {
        "const": "dependency_pin_v1"
      },
      "pin_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "tenant_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "consumer": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "enum": [
              "composition_project",
              "brand_template_revision"
            ]
          },
          "id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "kind": {
                  "const": "composition_project"
                }
              },
              "required": [
                "kind"
              ]
            },
            "then": {
              "properties": {
                "id": {
                  "$ref": "common.schema.json#/$defs/CompositionProjectId"
                }
              }
            }
          }
        ]
      },
      "dependency": {
        "oneOf": [
          {
            "$ref": "#/$defs/BrandRevisionPin"
          },
          {
            "$ref": "#/$defs/AvatarPin"
          },
          {
            "$ref": "#/$defs/VoiceProfilePin"
          },
          {
            "$ref": "#/$defs/StorageObjectPin"
          }
        ]
      },
      "pinned_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "upgrade": {
        "const": "explicit_only"
      }
    },
    "$defs": {
      "BrandRevisionPin": {
        "description": "P00-03 BrandRevisionRef names + the revision digest.",
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
            "description": "Opaque immutable revision id; a moving alias such as latest/head/current is never a pin.",
            "allOf": [
              {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              },
              {
                "not": {
                  "enum": [
                    "latest",
                    "head",
                    "current"
                  ]
                }
              }
            ]
          },
          "brand_revision_digest_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          }
        }
      },
      "AvatarPin": {
        "description": "P00-03 AvatarRef: existing Avatar owner version (avatar.entity.ts version) + optional execution snapshot.",
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
      "VoiceProfilePin": {
        "description": "P00-03 VoiceProfileRef: existing Voice profile owner version (voice-profile.entity.ts version) + optional execution snapshot.",
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
      "StorageObjectPin": {
        "description": "P00-03 StorageObjectRef identity fields.",
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
          }
        }
      }
    }
  },
  "project-asset-grant.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/scope-grants/v1/project-asset-grant.schema.json",
    "title": "project_asset_grant_v1",
    "description": "A deliberate, authorized import of an asset into a Composition project creates this project grant plus a persistent Storage project reference (KESIN PR04, MIMARI \u00a75 'Kal\u0131c\u0131 proje'). Project members read/use the asset through it; it never grants access to the source conversation or Memory. Deleting the source conversation does not change it. Removing from the project, revoking the grant and deleting the asset everywhere are separate operations (scope-rules.json project_asset_operations). A persistent reference is not a temporary worker lease. attach_idempotency_key (K67): a retried import of the same (project, asset) with the same key resolves to this same grant, never a duplicate binding. binding_generation (K67): bumped by every status change; project_asset_operations act only on the exact grant_id + expected binding_generation they were given, so a stale/old compensation can never release a newer binding.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "grant_id",
      "tenant_id",
      "project",
      "asset",
      "attach_idempotency_key",
      "binding_generation",
      "storage_reference",
      "provenance",
      "imported_by_user_id",
      "audience",
      "permissions",
      "status",
      "created_at",
      "status_changed_at"
    ],
    "properties": {
      "schema_version": {
        "const": "project_asset_grant_v1"
      },
      "grant_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "tenant_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "project": {
        "$ref": "#/$defs/ProjectRef"
      },
      "attach_idempotency_key": {
        "description": "Caller-supplied key for one logical (project, asset) attach attempt; a retry with the same key on the same pair replays this grant instead of creating a second active binding.",
        "type": "string",
        "minLength": 8,
        "maxLength": 128
      },
      "binding_generation": {
        "description": "CAS counter for this binding; project_asset_operations require the caller's expected_binding_generation to match before changing status.",
        "$ref": "common.schema.json#/$defs/Generation"
      },
      "asset": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "owner_bc",
          "storage_object_id",
          "checksum_sha256"
        ],
        "properties": {
          "owner_bc": {
            "const": "storage"
          },
          "storage_object_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "checksum_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          }
        }
      },
      "storage_reference": {
        "$ref": "#/$defs/StorageReference"
      },
      "provenance": {
        "description": "Where the asset came from. Provenance only: later project reads/renders never depend on the source existing.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "source_kind",
          "conversation_id",
          "message_id"
        ],
        "properties": {
          "source_kind": {
            "enum": [
              "conversation_artifact",
              "upload",
              "stock",
              "connector_import",
              "generation"
            ]
          },
          "conversation_id": {
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              },
              {
                "type": "null"
              }
            ]
          },
          "message_id": {
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              },
              {
                "type": "null"
              }
            ]
          }
        }
      },
      "imported_by_user_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "audience": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "const": "project_members"
          },
          "id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "permissions": {
        "type": "array",
        "minItems": 1,
        "maxItems": 2,
        "uniqueItems": true,
        "items": {
          "enum": [
            "read",
            "use_in_context"
          ]
        }
      },
      "status": {
        "enum": [
          "active",
          "removed_from_project",
          "revoked",
          "asset_deleted"
        ]
      },
      "created_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "status_changed_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "provenance": {
              "properties": {
                "source_kind": {
                  "const": "conversation_artifact"
                }
              }
            }
          }
        },
        "then": {
          "properties": {
            "provenance": {
              "properties": {
                "conversation_id": {
                  "$ref": "common.schema.json#/$defs/OpaqueId"
                }
              }
            }
          }
        }
      }
    ],
    "$defs": {
      "ProjectRef": {
        "description": "Composition project (Spark project entry, PR #294: private, tenant + owner scoped, id cprj_<uuid>).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "owner_bc",
          "project_id",
          "channel_id"
        ],
        "properties": {
          "owner_bc": {
            "const": "composition"
          },
          "project_id": {
            "type": "string",
            "pattern": "^cprj_[0-9a-f-]{36}$"
          },
          "channel_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "StorageReference": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "reference_id",
          "kind",
          "created_at",
          "released_at"
        ],
        "properties": {
          "reference_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "kind": {
            "const": "persistent_project_reference"
          },
          "created_at": {
            "$ref": "common.schema.json#/$defs/Timestamp"
          },
          "released_at": {
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/Timestamp"
              },
              {
                "type": "null"
              }
            ]
          }
        }
      }
    }
  },
  "resource-scope.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/scope-grants/v1/resource-scope.schema.json",
    "title": "resource_scope_v1",
    "description": "Scope record carried by every personal or content record (conversation, Memory item, personal instruction, skill, Composition project, Storage object). New personal records start private; a tenant owner/admin role alone never reads the content. The owner is always a known user (no owner-less scope).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "resource",
      "tenant_id",
      "owner_user_id",
      "scope_level",
      "channel_id",
      "project_id",
      "initial_visibility",
      "visibility",
      "acl_version",
      "scope_generation",
      "created_at"
    ],
    "properties": {
      "schema_version": {
        "const": "resource_scope_v1"
      },
      "resource": {
        "$ref": "common.schema.json#/$defs/ResourceRef"
      },
      "tenant_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "owner_user_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "scope_level": {
        "description": "personal: the owner's own record. channel/project: record living in that container; reading it still needs ownership or an explicit grant.",
        "enum": [
          "personal",
          "channel",
          "project"
        ]
      },
      "channel_id": {
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          {
            "type": "null"
          }
        ]
      },
      "project_id": {
        "description": "Always a Composition project (PR #294); never a generic OpaqueId.",
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/CompositionProjectId"
          },
          {
            "type": "null"
          }
        ]
      },
      "initial_visibility": {
        "description": "Frozen at creation: new records are private (P00-07, PR01).",
        "const": "private"
      },
      "visibility": {
        "$ref": "common.schema.json#/$defs/Visibility"
      },
      "acl_version": {
        "type": "integer",
        "minimum": 1
      },
      "scope_generation": {
        "$ref": "common.schema.json#/$defs/Generation"
      },
      "created_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "scope_level": {
              "const": "channel"
            }
          },
          "required": [
            "scope_level"
          ]
        },
        "then": {
          "properties": {
            "channel_id": {
              "$ref": "common.schema.json#/$defs/OpaqueId"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "scope_level": {
              "const": "project"
            }
          },
          "required": [
            "scope_level"
          ]
        },
        "then": {
          "properties": {
            "project_id": {
              "$ref": "common.schema.json#/$defs/CompositionProjectId"
            }
          }
        }
      },
      {
        "description": "A resource_scope_v1 that scopes a Composition project itself always identifies it with the real cprj_ id (PR #294), never a generic OpaqueId.",
        "if": {
          "properties": {
            "resource": {
              "properties": {
                "resource_type": {
                  "const": "composition_project"
                }
              },
              "required": [
                "resource_type"
              ]
            }
          },
          "required": [
            "resource"
          ]
        },
        "then": {
          "properties": {
            "resource": {
              "properties": {
                "resource_id": {
                  "$ref": "common.schema.json#/$defs/CompositionProjectId"
                }
              }
            }
          }
        }
      }
    ]
  },
  "skill-installation.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/scope-grants/v1/skill-installation.schema.json",
    "title": "skill_installation_v1",
    "description": "USER_MANAGED skill installation and activation (FAZ-01D SkillInstallation + SkillActivation). Pins an exact revision/digest using the P00-03 SkillRevisionRef field names (assistant-runtime v1 owner-refs.schema.json; replaced by a $ref after Wave 0 acceptance); activation scope/surface is separate from installation. install_generation is the TK-04 cache key part for user skills (actor/scope/install generation); SYSTEM_INTERNAL guides have no installation and are never listed here. revoke_generation is a separate TK-04/K97 cache-fence counter: a P00-11 security_revoke on the installed skill_revision_id bumps it on every installation using that revision, so a security-revoked revision's stale user skill index can never be served (install_generation alone only tracks re-installs/updates, not a revoke).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "installation_id",
      "tenant_id",
      "source_layer",
      "installer_user_id",
      "install_scope",
      "skill",
      "install_generation",
      "revoke_generation",
      "update_policy",
      "activation",
      "status",
      "created_at",
      "updated_at"
    ],
    "properties": {
      "schema_version": {
        "const": "skill_installation_v1"
      },
      "installation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "tenant_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "source_layer": {
        "description": "Optional PLATFORM catalog package or a PERSONAL/WORKSPACE skill. SYSTEM_INTERNAL is not installable.",
        "enum": [
          "platform",
          "personal",
          "workspace"
        ]
      },
      "installer_user_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "install_scope": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "id"
        ],
        "properties": {
          "kind": {
            "enum": [
              "personal",
              "channel",
              "workspace"
            ]
          },
          "id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "skill": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "skill_id",
          "skill_revision_id",
          "body_digest_sha256"
        ],
        "properties": {
          "skill_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "skill_revision_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "body_digest_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          }
        }
      },
      "install_generation": {
        "$ref": "common.schema.json#/$defs/Generation"
      },
      "revoke_generation": {
        "description": "Bumped by a P00-11 security_revoke (revocation_event_v1) on skill.skill_revision_id; part of the TK-04/K97 user-skill cache key alongside install_generation.",
        "$ref": "common.schema.json#/$defs/Generation"
      },
      "update_policy": {
        "enum": [
          "pinned",
          "security_metadata_patch_auto",
          "review_diff_required"
        ]
      },
      "activation": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "enabled",
          "surfaces",
          "auto_use",
          "activation_version"
        ],
        "properties": {
          "enabled": {
            "type": "boolean"
          },
          "surfaces": {
            "type": "array",
            "maxItems": 3,
            "uniqueItems": true,
            "items": {
              "enum": [
                "chat",
                "spark",
                "workflow_authoring"
              ]
            }
          },
          "auto_use": {
            "enum": [
              "auto",
              "user_only"
            ]
          },
          "activation_version": {
            "type": "integer",
            "minimum": 1
          }
        }
      },
      "status": {
        "enum": [
          "installed",
          "disabled",
          "uninstalled"
        ]
      },
      "created_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "updated_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "source_layer": {
              "const": "personal"
            }
          },
          "required": [
            "source_layer"
          ]
        },
        "then": {
          "properties": {
            "install_scope": {
              "properties": {
                "kind": {
                  "const": "personal"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "enum": [
                "disabled",
                "uninstalled"
              ]
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "properties": {
            "activation": {
              "properties": {
                "enabled": {
                  "const": false
                }
              }
            }
          }
        }
      }
    ]
  },
  "support-access-grant.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/scope-grants/v1/support-access-grant.schema.json",
    "title": "support_access_grant_v1",
    "description": "Separate support content access: approved by the content owner, bound to a purpose, an exact resource list and a time window, audited, read-only. The feature gate stays disabled and it is not a beta prerequisite (MIMARI \u00a73, KESIN PR02).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "grant_id",
      "tenant_id",
      "support_agent_id",
      "resources",
      "purpose",
      "content_owner_approval",
      "permissions",
      "starts_at",
      "expires_at",
      "status",
      "audit"
    ],
    "properties": {
      "schema_version": {
        "const": "support_access_grant_v1"
      },
      "grant_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "tenant_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "support_agent_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "resources": {
        "type": "array",
        "minItems": 1,
        "maxItems": 20,
        "items": {
          "$ref": "common.schema.json#/$defs/ResourceRef"
        }
      },
      "purpose": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "code",
          "ticket_ref"
        ],
        "properties": {
          "code": {
            "enum": [
              "user_requested_help",
              "incident_investigation"
            ]
          },
          "ticket_ref": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "content_owner_approval": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "user_id",
          "decision_ref",
          "approved_at"
        ],
        "properties": {
          "user_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "decision_ref": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "approved_at": {
            "$ref": "common.schema.json#/$defs/Timestamp"
          }
        }
      },
      "permissions": {
        "type": "array",
        "minItems": 1,
        "maxItems": 1,
        "items": {
          "const": "read"
        }
      },
      "starts_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "expires_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "status": {
        "enum": [
          "approved",
          "active",
          "expired",
          "revoked"
        ]
      },
      "audit": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "audit_log_ref"
        ],
        "properties": {
          "audit_log_ref": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      }
    }
  },
  "visibility-change.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/scope-grants/v1/visibility-change.schema.json",
    "title": "visibility_change_v1",
    "description": "Owner-authorized private/shared change. Sharing needs explicit grants and a content check at share time; unsharing revokes the grants. Both bump the scope generation and write the cache-invalidation outbox event in the same transaction. Private Memory/context is never added to a shared record automatically.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "command_id",
      "tenant_id",
      "resource",
      "requested_by_user_id",
      "expected_acl_version",
      "from_visibility",
      "to_visibility",
      "grants_created",
      "grants_revoked",
      "content_check",
      "cache_invalidation",
      "decided_at"
    ],
    "properties": {
      "schema_version": {
        "const": "visibility_change_v1"
      },
      "command_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "tenant_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "resource": {
        "$ref": "common.schema.json#/$defs/ResourceRef"
      },
      "requested_by_user_id": {
        "description": "The resource owner; an owner/admin tenant role that is not the resource owner is rejected.",
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "expected_acl_version": {
        "type": "integer",
        "minimum": 1
      },
      "from_visibility": {
        "$ref": "common.schema.json#/$defs/Visibility"
      },
      "to_visibility": {
        "$ref": "common.schema.json#/$defs/Visibility"
      },
      "grants_created": {
        "type": "array",
        "maxItems": 100,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/OpaqueId"
        }
      },
      "grants_revoked": {
        "type": "array",
        "maxItems": 100,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/OpaqueId"
        }
      },
      "content_check": {
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "check_id",
              "result"
            ],
            "properties": {
              "check_id": {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              },
              "result": {
                "const": "passed"
              }
            }
          },
          {
            "type": "null"
          }
        ]
      },
      "cache_invalidation": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "scope_generation_before",
          "scope_generation_after",
          "outbox_event_id"
        ],
        "properties": {
          "scope_generation_before": {
            "$ref": "common.schema.json#/$defs/Generation"
          },
          "scope_generation_after": {
            "$ref": "common.schema.json#/$defs/Generation"
          },
          "outbox_event_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "decided_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "to_visibility": {
              "const": "shared"
            }
          },
          "required": [
            "to_visibility"
          ]
        },
        "then": {
          "properties": {
            "from_visibility": {
              "const": "private"
            },
            "grants_created": {
              "minItems": 1
            },
            "grants_revoked": {
              "maxItems": 0
            },
            "content_check": {
              "type": "object"
            }
          }
        },
        "else": {
          "properties": {
            "from_visibility": {
              "const": "shared"
            },
            "grants_created": {
              "maxItems": 0
            },
            "content_check": {
              "type": "null"
            }
          }
        }
      }
    ]
  }
} as const;

export const DOCUMENT_TYPES = ["connector-resource-grant", "content-access-grant", "dependency-pin", "project-asset-grant", "resource-scope", "skill-installation", "support-access-grant", "visibility-change"] as const;
export type DocumentType = "connector-resource-grant" | "content-access-grant" | "dependency-pin" | "project-asset-grant" | "resource-scope" | "skill-installation" | "support-access-grant" | "visibility-change";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "connector-resource-grant": [
    "connector_resource_grant_v1"
  ],
  "content-access-grant": [
    "content_access_grant_v1"
  ],
  "dependency-pin": [
    "dependency_pin_v1"
  ],
  "project-asset-grant": [
    "project_asset_grant_v1"
  ],
  "resource-scope": [
    "resource_scope_v1"
  ],
  "skill-installation": [
    "skill_installation_v1"
  ],
  "support-access-grant": [
    "support_access_grant_v1"
  ],
  "visibility-change": [
    "visibility_change_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {
  "project-asset-grant": {
    "status": [
      "active",
      "asset_deleted",
      "removed_from_project",
      "revoked"
    ]
  },
  "skill-installation": {
    "status": [
      "disabled",
      "installed",
      "uninstalled"
    ]
  },
  "support-access-grant": {
    "status": [
      "active",
      "approved",
      "expired",
      "revoked"
    ]
  }
};

export type ConnectorResourceGrant = {
    readonly "schema_version": "connector_resource_grant_v1";
    readonly "grant_id": string;
    readonly "tenant_id": string;
    readonly "connection": {
    readonly "connector_definition_id": string;
    readonly "connection_id": string;
    readonly "connection_revision": number;
  };
    readonly "owner_user_id": string;
    readonly "grantee": unknown;
    readonly "resources": readonly ({
    readonly "resource_kind": string;
    readonly "resource_id": string;
  })[];
    readonly "tool_revision_ids": readonly (string)[];
    readonly "oauth_consent_ref": string;
    readonly "grant_generation": number;
    readonly "created_at": string;
    readonly "revoked_at": (string) | (null);
  };
export type ContentAccessGrant = {
    readonly "schema_version": "content_access_grant_v1";
    readonly "grant_id": string;
    readonly "tenant_id": string;
    readonly "resource": unknown;
    readonly "grantor_user_id": string;
    readonly "audience": unknown;
    readonly "permissions": readonly ("read" | "use_in_context" | "edit")[];
    readonly "grant_version": number;
    readonly "created_at": string;
    readonly "revoked_at": (string) | (null);
  };
export type DependencyPin = {
    readonly "schema_version": "dependency_pin_v1";
    readonly "pin_id": string;
    readonly "tenant_id": string;
    readonly "consumer": {
    readonly "kind": "composition_project" | "brand_template_revision";
    readonly "id": string;
  };
    readonly "dependency": (unknown);
    readonly "pinned_at": string;
    readonly "upgrade": "explicit_only";
  };
export type ProjectAssetGrant = {
    readonly "schema_version": "project_asset_grant_v1";
    readonly "grant_id": string;
    readonly "tenant_id": string;
    readonly "project": unknown;
    readonly "attach_idempotency_key": string;
    readonly "binding_generation": number;
    readonly "asset": {
    readonly "owner_bc": "storage";
    readonly "storage_object_id": string;
    readonly "checksum_sha256": string;
  };
    readonly "storage_reference": unknown;
    readonly "provenance": {
    readonly "source_kind": "conversation_artifact" | "upload" | "stock" | "connector_import" | "generation";
    readonly "conversation_id": (string) | (null);
    readonly "message_id": (string) | (null);
  };
    readonly "imported_by_user_id": string;
    readonly "audience": {
    readonly "kind": "project_members";
    readonly "id": string;
  };
    readonly "permissions": readonly ("read" | "use_in_context")[];
    readonly "status": "active" | "removed_from_project" | "revoked" | "asset_deleted";
    readonly "created_at": string;
    readonly "status_changed_at": string;
  };
export type ResourceScope = {
    readonly "schema_version": "resource_scope_v1";
    readonly "resource": unknown;
    readonly "tenant_id": string;
    readonly "owner_user_id": string;
    readonly "scope_level": "personal" | "channel" | "project";
    readonly "channel_id": (string) | (null);
    readonly "project_id": (string) | (null);
    readonly "initial_visibility": "private";
    readonly "visibility": "private" | "shared";
    readonly "acl_version": number;
    readonly "scope_generation": number;
    readonly "created_at": string;
  };
export type SkillInstallation = {
    readonly "schema_version": "skill_installation_v1";
    readonly "installation_id": string;
    readonly "tenant_id": string;
    readonly "source_layer": "platform" | "personal" | "workspace";
    readonly "installer_user_id": string;
    readonly "install_scope": {
    readonly "kind": "personal" | "channel" | "workspace";
    readonly "id": string;
  };
    readonly "skill": {
    readonly "skill_id": string;
    readonly "skill_revision_id": string;
    readonly "body_digest_sha256": string;
  };
    readonly "install_generation": number;
    readonly "revoke_generation": number;
    readonly "update_policy": "pinned" | "security_metadata_patch_auto" | "review_diff_required";
    readonly "activation": {
    readonly "enabled": boolean;
    readonly "surfaces": readonly ("chat" | "spark" | "workflow_authoring")[];
    readonly "auto_use": "auto" | "user_only";
    readonly "activation_version": number;
  };
    readonly "status": "installed" | "disabled" | "uninstalled";
    readonly "created_at": string;
    readonly "updated_at": string;
  };
export type SupportAccessGrant = {
    readonly "schema_version": "support_access_grant_v1";
    readonly "grant_id": string;
    readonly "tenant_id": string;
    readonly "support_agent_id": string;
    readonly "resources": readonly (unknown)[];
    readonly "purpose": {
    readonly "code": "user_requested_help" | "incident_investigation";
    readonly "ticket_ref": string;
  };
    readonly "content_owner_approval": {
    readonly "user_id": string;
    readonly "decision_ref": string;
    readonly "approved_at": string;
  };
    readonly "permissions": readonly ("read")[];
    readonly "starts_at": string;
    readonly "expires_at": string;
    readonly "status": "approved" | "active" | "expired" | "revoked";
    readonly "audit": {
    readonly "audit_log_ref": string;
  };
  };
export type VisibilityChange = {
    readonly "schema_version": "visibility_change_v1";
    readonly "command_id": string;
    readonly "tenant_id": string;
    readonly "resource": unknown;
    readonly "requested_by_user_id": string;
    readonly "expected_acl_version": number;
    readonly "from_visibility": "private" | "shared";
    readonly "to_visibility": "private" | "shared";
    readonly "grants_created": readonly (string)[];
    readonly "grants_revoked": readonly (string)[];
    readonly "content_check": ({
    readonly "check_id": string;
    readonly "result": "passed";
  }) | (null);
    readonly "cache_invalidation": {
    readonly "scope_generation_before": number;
    readonly "scope_generation_after": number;
    readonly "outbox_event_id": string;
  };
    readonly "decided_at": string;
  };

export const reader = new ContractPackageReader({
  package: "scope-grants",
  schemas: SCHEMAS as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
