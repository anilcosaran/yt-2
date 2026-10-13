// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/connector-media/v1
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
    "$id": "https://youtorch.local/contracts/agentic-spark/connector-media/v1/common.schema.json",
    "title": "connector_media_common_v1",
    "description": "Shared definitions for the P03-19 connector-media package (remote file ref and Spark project import). Not a standalone document type.",
    "$defs": {
      "OpaqueId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
      },
      "Timestamp": {
        "type": "string",
        "format": "date-time"
      },
      "Sha256": {
        "type": "string",
        "pattern": "^[a-f0-9]{64}$"
      },
      "ResourceRef": {
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
      },
      "MediaKind": {
        "enum": [
          "video",
          "image",
          "audio"
        ]
      },
      "ImportState": {
        "description": "requested -> transferring -> awaiting_readiness -> placing -> completed; failed/conflict are terminal. `conflict` keeps the imported, attached source in the project (never lost); only the timeline placement did not apply.",
        "enum": [
          "requested",
          "transferring",
          "awaiting_readiness",
          "placing",
          "completed",
          "failed",
          "conflict"
        ]
      },
      "Placement": {
        "description": "What the user explicitly asked: `none` = artifact.attach only (source in the project, no timeline change); `new_scene` = one clip in a new scene appended to the strip. Replacing an existing clip is not in v1.",
        "enum": [
          "none",
          "new_scene"
        ]
      },
      "ReasonCode": {
        "description": "Safe failure vocabulary (connectors/MIMARI \u00a76 + Storage/Composition outcomes). Never a provider body, URL or token.",
        "enum": [
          "needs_connection",
          "connection_disabled",
          "reauth_required",
          "scope_required",
          "resource_selection_required",
          "forbidden",
          "feature_unavailable",
          "source_version_changed",
          "source_not_found",
          "unsupported_media_type",
          "size_limit_exceeded",
          "upstream_unavailable",
          "rate_limited",
          "transfer_incomplete",
          "storage_refused",
          "storage_mode_unsupported",
          "not_ready_timeout",
          "attach_refused",
          "project_unavailable",
          "version_conflict"
        ]
      }
    }
  },
  "media-import.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/connector-media/v1/media-import.schema.json",
    "title": "connector_media_import_v1",
    "description": "P03-19 status view of one Connector file -> Spark project import: RemoteFileRef -> current grant -> durable Storage copy (checksum/probe/security/readiness) -> project grant + Storage reference (artifact.attach) -> the explicit placement. The storage object is the project's own copy in the consumer's Storage (their payer path); a later disconnect never breaks it. The view never carries a URL, token or provider body.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "import_id",
      "project_id",
      "state",
      "placement",
      "source",
      "storage_object_id",
      "source_id",
      "scene_id",
      "reason_code",
      "version",
      "created_at",
      "updated_at"
    ],
    "properties": {
      "schema_version": {
        "const": "connector_media_import_v1"
      },
      "import_id": {
        "type": "string",
        "pattern": "^cmi_[0-9a-f-]{36}$"
      },
      "project_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "state": {
        "$ref": "common.schema.json#/$defs/ImportState"
      },
      "placement": {
        "$ref": "common.schema.json#/$defs/Placement"
      },
      "source": {
        "description": "The requested ref plus what the Connector resolved (current provider version, size, type).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref"
        ],
        "properties": {
          "ref": {
            "$ref": "remote-file-ref.schema.json"
          },
          "resolved_version": {
            "type": "string",
            "minLength": 1,
            "maxLength": 256
          },
          "size_bytes": {
            "type": "integer",
            "minimum": 0
          },
          "mime_type": {
            "type": "string",
            "pattern": "^[a-z]+/[A-Za-z0-9.+-]{1,127}$"
          },
          "media_kind": {
            "$ref": "common.schema.json#/$defs/MediaKind"
          }
        }
      },
      "storage_object_id": {
        "anyOf": [
          {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          {
            "type": "null"
          }
        ]
      },
      "checksum_sha256": {
        "$ref": "common.schema.json#/$defs/Sha256"
      },
      "source_id": {
        "anyOf": [
          {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          {
            "type": "null"
          }
        ]
      },
      "scene_id": {
        "anyOf": [
          {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          {
            "type": "null"
          }
        ]
      },
      "reason_code": {
        "anyOf": [
          {
            "$ref": "common.schema.json#/$defs/ReasonCode"
          },
          {
            "type": "null"
          }
        ]
      },
      "version": {
        "type": "integer",
        "minimum": 1
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
            "state": {
              "enum": [
                "failed",
                "conflict"
              ]
            }
          }
        },
        "then": {
          "properties": {
            "reason_code": {
              "$ref": "common.schema.json#/$defs/ReasonCode"
            }
          }
        },
        "else": {
          "properties": {
            "reason_code": {
              "type": "null"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "state": {
              "enum": [
                "awaiting_readiness",
                "placing",
                "completed",
                "conflict"
              ]
            }
          }
        },
        "then": {
          "required": [
            "checksum_sha256"
          ],
          "properties": {
            "storage_object_id": {
              "$ref": "common.schema.json#/$defs/OpaqueId"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "state": {
              "const": "completed"
            },
            "placement": {
              "const": "new_scene"
            }
          }
        },
        "then": {
          "properties": {
            "scene_id": {
              "$ref": "common.schema.json#/$defs/OpaqueId"
            },
            "source_id": {
              "$ref": "common.schema.json#/$defs/OpaqueId"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "state": {
              "const": "completed"
            },
            "placement": {
              "const": "none"
            }
          }
        },
        "then": {
          "properties": {
            "scene_id": {
              "type": "null"
            },
            "source_id": {
              "$ref": "common.schema.json#/$defs/OpaqueId"
            }
          }
        }
      }
    ]
  },
  "remote-file-ref.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/connector-media/v1/remote-file-ref.schema.json",
    "title": "remote_file_ref_v1",
    "description": "connectors/MIMARI \u00a72 RemoteFileRef: a typed pointer to one file of one granted Connector resource. Everything except the connection/resource/file identity is an untrusted hint: the Connector re-resolves the file under the actor's current grant before any byte moves, and Storage probes the copy. A ref never carries a URL, a signed download link, a token or a provider body, so it is safe in a prompt, a manifest or an event.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "connection_id",
      "resource",
      "file_id"
    ],
    "properties": {
      "schema_version": {
        "const": "remote_file_ref_v1"
      },
      "connection_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "resource": {
        "description": "The granted resource the file belongs to (e.g. a Drive folder/file grant).",
        "$ref": "common.schema.json#/$defs/ResourceRef"
      },
      "file_id": {
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$"
      },
      "source_version": {
        "description": "Provider version/ETag the user picked. When set, a different current version is `source_version_changed` (never silently different bytes).",
        "type": "string",
        "minLength": 1,
        "maxLength": 256
      },
      "size_hint_bytes": {
        "type": "integer",
        "minimum": 0
      },
      "mime_hint": {
        "type": "string",
        "pattern": "^[a-z]+/[A-Za-z0-9.+-]{1,127}$"
      },
      "rights_snapshot_ref": {
        "description": "Opaque ref of the rights/grant snapshot the picker showed (audit only; never authority).",
        "$ref": "common.schema.json#/$defs/OpaqueId"
      }
    }
  }
} as const;

export const DOCUMENT_TYPES = ["media-import", "remote-file-ref"] as const;
export type DocumentType = "media-import" | "remote-file-ref";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "media-import": [
    "connector_media_import_v1"
  ],
  "remote-file-ref": [
    "remote_file_ref_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {};

export type MediaImport = {
    readonly "schema_version": "connector_media_import_v1";
    readonly "import_id": string;
    readonly "project_id": string;
    readonly "state": "requested" | "transferring" | "awaiting_readiness" | "placing" | "completed" | "failed" | "conflict";
    readonly "placement": "none" | "new_scene";
    readonly "source": {
    readonly "ref": unknown;
    readonly "resolved_version"?: string;
    readonly "size_bytes"?: number;
    readonly "mime_type"?: string;
    readonly "media_kind"?: "video" | "image" | "audio";
  };
    readonly "storage_object_id": (string) | (null);
    readonly "checksum_sha256"?: string;
    readonly "source_id": (string) | (null);
    readonly "scene_id": (string) | (null);
    readonly "reason_code": ("needs_connection" | "connection_disabled" | "reauth_required" | "scope_required" | "resource_selection_required" | "forbidden" | "feature_unavailable" | "source_version_changed" | "source_not_found" | "unsupported_media_type" | "size_limit_exceeded" | "upstream_unavailable" | "rate_limited" | "transfer_incomplete" | "storage_refused" | "storage_mode_unsupported" | "not_ready_timeout" | "attach_refused" | "project_unavailable" | "version_conflict") | (null);
    readonly "version": number;
    readonly "created_at": string;
    readonly "updated_at": string;
  };
export type RemoteFileRef = {
    readonly "schema_version": "remote_file_ref_v1";
    readonly "connection_id": string;
    readonly "resource": unknown;
    readonly "file_id": string;
    readonly "source_version"?: string;
    readonly "size_hint_bytes"?: number;
    readonly "mime_hint"?: string;
    readonly "rights_snapshot_ref"?: string;
  };

export const reader = new ContractPackageReader({
  package: "connector-media",
  schemas: SCHEMAS as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
