// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/continuity/v1
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
    "$id": "https://youtorch.local/contracts/agentic-spark/continuity/v1/common.schema.json",
    "title": "continuity_common_v1",
    "description": "Shared definitions of the continuity v1 package (P05-01: how one generated video shot continues from, or stays independent of, another). Not a standalone document type. Ids, hashes, model ids and timestamps are owned by assistant-runtime v1; stable shot ids, seconds, owner resource refs, catalog capability refs, exact artifact revision refs and generated take refs by video-preparation v1. What a model can do (tasks, frames, references, native extension) is owned by video-generation v1 and only read here.",
    "$defs": {
      "ContinuityMode": {
        "description": "How one generation shot relates to the shots around it. independent = no visual dependency (B-roll, a separate scene, the root of a chain). reference_guided = an independent generation guided by the exact identity reference set (multi-reference images that are not frames); it is also how a chain is re-anchored (P05-03). last_frame_chain = the first frame is the last frame of the predecessor's selected take (image_to_video); a frame never guarantees identity, sound or motion continuity. native_extension = the provider continues the predecessor's clip itself through a provider handle. A model supports exactly the modes continuity-rules.json `mode_requirements` derive from its video_generation_capabilities_v1 declaration; an unsupported mode is refused (continuity_mode_unsupported) and never replaced by another one.",
        "enum": [
          "independent",
          "reference_guided",
          "last_frame_chain",
          "native_extension"
        ]
      },
      "ChainDepth": {
        "description": "Number of continuation links between a shot and the root of its chain: 0 for a root (independent or reference_guided), predecessor depth + 1 for a chained shot. The plan's max_chain_depth bounds it; the schema ceiling is 32.",
        "type": "integer",
        "minimum": 0,
        "maximum": 32
      },
      "IdentityReferenceSet": {
        "description": "The exact owner references (avatar version, character/product/style images) a shot must keep: 1..10 refs, each pinned to its owner revision. Never a name or a description; a changed owner revision is a different set. Set equality is the equality of the (owner_bc, resource_kind, resource_id, resource_revision) tuples, order ignored.",
        "type": "array",
        "minItems": 1,
        "maxItems": 10,
        "uniqueItems": true,
        "items": {
          "allOf": [
            {
              "$ref": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/common.schema.json#/$defs/OwnerResourceRef"
            },
            {
              "required": [
                "resource_revision"
              ]
            }
          ]
        }
      },
      "FrameAnchor": {
        "description": "The exact frame a last_frame_chain generation starts from: where in the predecessor's selected take it was taken, its hash and the hidden Storage asset that holds it. The frame is an intermediate derivative (Storage workflow_artifact_role intermediate), never the user's Frame Extract result (P05-06 owns the role and retention). The frame is an image: it carries no identity, sound or motion guarantee.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "time_seconds",
          "frame_sha256",
          "asset",
          "artifact_role"
        ],
        "properties": {
          "time_seconds": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/common.schema.json#/$defs/Seconds"
          },
          "frame_index": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100000
          },
          "frame_sha256": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          },
          "asset": {
            "description": "The Storage object of the frame. Only a Storage asset reference: never a URL, a signed link or bytes.",
            "allOf": [
              {
                "$ref": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/common.schema.json#/$defs/OwnerResourceRef"
              },
              {
                "properties": {
                  "owner_bc": {
                    "const": "storage"
                  },
                  "resource_kind": {
                    "const": "asset"
                  }
                }
              }
            ]
          },
          "artifact_role": {
            "const": "intermediate"
          }
        }
      },
      "QcStatus": {
        "description": "Result of the QC of one join (the previous take to this attempt's output) under the common QC profile. not_run = the take does not exist yet or the profile did not run; uncertain is never a success (QA-160): it is attention, never an automatic identity pass.",
        "enum": [
          "not_run",
          "passed",
          "failed",
          "uncertain"
        ]
      },
      "QcProfileRef": {
        "description": "The versioned QC profile a join is measured with (KARAR-FRAME-EXTRACT-VE-SANDBOX renderer and media QC profile). Same shape as media-qc v1 ProfileRef, mirrored here so the foreign $ref set of this package stays closed. A threshold is never relaxed after a result: a changed profile is a new revision.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "profile_id",
          "profile_revision"
        ],
        "properties": {
          "profile_id": {
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9.-]{1,63}$"
          },
          "profile_revision": {
            "type": "integer",
            "minimum": 1
          }
        }
      },
      "IssueCode": {
        "description": "Continuity validation issue codes in the fixed validator order of continuity-rules.json `issue_order`. Every issue blocks: a report with any issue is invalid. Nothing is repaired or replaced silently.",
        "enum": [
          "continuity_mode_unsupported",
          "reference_set_exceeds_model_limit",
          "duplicate_generation_shot_id",
          "predecessor_unknown",
          "chain_cycle",
          "chain_depth_mismatch",
          "chain_depth_exceeds_max",
          "take_identity_invalid",
          "manifest_continues_own_shot",
          "provider_handle_expired",
          "manifest_job_mismatch",
          "manifest_shot_unknown",
          "manifest_mode_mismatch",
          "manifest_predecessor_mismatch",
          "manifest_chain_depth_mismatch",
          "manifest_model_mismatch",
          "manifest_identity_set_mismatch"
        ]
      }
    }
  },
  "continuation-manifest.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/continuity/v1/continuation-manifest.schema.json",
    "title": "continuation_manifest_v1",
    "description": "What one generation attempt was continued from (P05-01): the previous selected take and its output hash, the anchor frame (last_frame_chain) or the provider handle by hash with its expiry (native_extension), the pinned identity references, short scene notes (location, light, camera), the exact model, the prompt hash, the seed, the chain depth and the QC of the join. Identifiers and hashes only: no prompt text, no raw provider handle, no URL and no bytes (a closed object). The take is identified like every GeneratedTake (`<generation_shot_id>-t<attempt>`); a recovery of the same operation keeps its attempt and its manifest. The seed is a request, never a guarantee of a deterministic result (seed_is_guarantee is the const false); the last frame alone is never an identity or sound guarantee. Record invariants (a manifest never continues its own shot, derived take ids, a handle that outlives its manifest) are in continuity-rules.json.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "job_id",
      "take",
      "mode",
      "model_id",
      "prompt_sha256",
      "seed",
      "chain_depth",
      "qc",
      "created_at"
    ],
    "properties": {
      "schema_version": {
        "const": "continuation_manifest_v1"
      },
      "job_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "take": {
        "description": "The take this attempt produces (its identity is derivable before the take exists).",
        "$ref": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/common.schema.json#/$defs/GeneratedTakeRef"
      },
      "mode": {
        "$ref": "common.schema.json#/$defs/ContinuityMode"
      },
      "continued_from": {
        "description": "Present exactly for the chained modes (last_frame_chain, native_extension).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "previous_take",
          "previous_output_sha256"
        ],
        "properties": {
          "previous_take": {
            "description": "The predecessor's selected take at submit time. A later change of the selected take makes this manifest stale (P05-04).",
            "$ref": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/common.schema.json#/$defs/GeneratedTakeRef"
          },
          "previous_output_sha256": {
            "description": "Hash of the selected take's output bytes the continuation was built from.",
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          },
          "anchor_frame": {
            "description": "last_frame_chain only: the exact frame the generation starts from.",
            "$ref": "common.schema.json#/$defs/FrameAnchor"
          },
          "provider_handle": {
            "description": "native_extension only: the provider handle of the predecessor's clip BY HASH (the raw handle never enters this document) and when the provider stops accepting it. An expired handle is never reused (P05-10).",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "handle_sha256",
              "expires_at"
            ],
            "properties": {
              "handle_sha256": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
              },
              "expires_at": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
              }
            }
          }
        }
      },
      "identity_reference_set": {
        "description": "The pinned identity and look references of this attempt (avatar version, character/product/style images, each with its owner revision). Required by reference_guided, forbidden by independent, optional on a chained mode.",
        "$ref": "common.schema.json#/$defs/IdentityReferenceSet"
      },
      "scene_notes": {
        "description": "Short notes on what the scene shows, kept across the join: location, light, camera. Not a prompt; at least one is present.",
        "type": "object",
        "additionalProperties": false,
        "minProperties": 1,
        "properties": {
          "location": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          },
          "light": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          },
          "camera": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          }
        }
      },
      "model_id": {
        "description": "The exact catalog model the attempt ran on; no silent model change.",
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/ModelId"
      },
      "prompt_sha256": {
        "description": "Hash of the prompt sent; the prompt text is never stored here.",
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
      },
      "seed": {
        "description": "The requested seed, when the model declares seed support. A provider seed is never presented as a deterministic-result guarantee.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "seed_is_guarantee"
        ],
        "properties": {
          "value": {
            "type": "integer",
            "minimum": 0,
            "maximum": 4294967295
          },
          "seed_is_guarantee": {
            "const": false
          }
        }
      },
      "chain_depth": {
        "$ref": "common.schema.json#/$defs/ChainDepth"
      },
      "qc": {
        "description": "The QC profile and the result of the join. uncertain is never a success.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "profile",
          "status"
        ],
        "properties": {
          "profile": {
            "$ref": "common.schema.json#/$defs/QcProfileRef"
          },
          "status": {
            "$ref": "common.schema.json#/$defs/QcStatus"
          }
        }
      },
      "created_at": {
        "description": "When the manifest was frozen for the attempt (the submit time). Handle expiry is judged against this instant here and against the executor's injected clock at resume (P05-10).",
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "mode": {
              "enum": [
                "last_frame_chain",
                "native_extension"
              ]
            }
          },
          "required": [
            "mode"
          ]
        },
        "then": {
          "required": [
            "continued_from"
          ],
          "properties": {
            "chain_depth": {
              "minimum": 1
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "mode": {
              "enum": [
                "independent",
                "reference_guided"
              ]
            }
          },
          "required": [
            "mode"
          ]
        },
        "then": {
          "not": {
            "required": [
              "continued_from"
            ]
          },
          "properties": {
            "chain_depth": {
              "const": 0
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "mode": {
              "const": "last_frame_chain"
            }
          },
          "required": [
            "mode"
          ]
        },
        "then": {
          "properties": {
            "continued_from": {
              "required": [
                "anchor_frame"
              ],
              "not": {
                "required": [
                  "provider_handle"
                ]
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "mode": {
              "const": "native_extension"
            }
          },
          "required": [
            "mode"
          ]
        },
        "then": {
          "properties": {
            "continued_from": {
              "required": [
                "provider_handle"
              ],
              "not": {
                "required": [
                  "anchor_frame"
                ]
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "mode": {
              "const": "reference_guided"
            }
          },
          "required": [
            "mode"
          ]
        },
        "then": {
          "required": [
            "identity_reference_set"
          ]
        }
      },
      {
        "if": {
          "properties": {
            "mode": {
              "const": "independent"
            }
          },
          "required": [
            "mode"
          ]
        },
        "then": {
          "not": {
            "required": [
              "identity_reference_set"
            ]
          }
        }
      }
    ]
  },
  "continuity-plan.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/continuity/v1/continuity-plan.schema.json",
    "title": "continuity_plan_v1",
    "description": "The continuity plan of one video job (P05-01): for every generation shot of one exact ShotPlan revision, how it relates to the others (independent, reference_guided, last_frame_chain, native_extension), which shot it continues from, which exact identity reference set it keeps and how deep its chain is. It only orders and constrains work; Workflow executes, Composition owns the plan, Provider owns what a model supports. A mode the shot's model does not declare is refused (continuity_mode_unsupported), never replaced. One long chain is never the default: independent shots and reference_guided re-anchors are chain roots (depth 0). Record invariants (unique shot ids, existing predecessor, acyclic chain, depth arithmetic, depth within max_chain_depth) are in continuity-rules.json.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "job_id",
      "shot_plan_ref",
      "max_chain_depth",
      "generation_shots"
    ],
    "properties": {
      "schema_version": {
        "const": "continuity_plan_v1"
      },
      "job_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "shot_plan_ref": {
        "description": "The exact ShotPlan revision the generation shots belong to. A ref whose digest no longer matches the owner's revision is stale (the owner decides; this document never re-reads it).",
        "allOf": [
          {
            "$ref": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/common.schema.json#/$defs/ArtifactRevisionRef"
          },
          {
            "properties": {
              "artifact_kind": {
                "const": "shot_plan"
              }
            }
          }
        ]
      },
      "max_chain_depth": {
        "$ref": "common.schema.json#/$defs/ChainDepth"
      },
      "generation_shots": {
        "description": "One entry per GenerationShot of the ShotPlan that needs a continuity decision (F21 GenerationShot ids, unique inside the plan).",
        "type": "array",
        "minItems": 1,
        "maxItems": 500,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "generation_shot_id",
            "mode",
            "capability",
            "chain_depth"
          ],
          "properties": {
            "generation_shot_id": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/common.schema.json#/$defs/StableId"
            },
            "mode": {
              "$ref": "common.schema.json#/$defs/ContinuityMode"
            },
            "capability": {
              "description": "The real catalog capability and exact model the shot runs on; the mode is validated against this model's video_generation_capabilities_v1 declaration. Without a model_id (or without a valid declaration) only `independent` is supported.",
              "$ref": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/common.schema.json#/$defs/CapabilityRef"
            },
            "predecessor_generation_shot_id": {
              "description": "The generation shot whose selected take this shot continues from. Required by the chained modes (last_frame_chain, native_extension), forbidden otherwise.",
              "$ref": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/common.schema.json#/$defs/StableId"
            },
            "identity_reference_set": {
              "description": "The exact identity reference set the shot keeps. Required by reference_guided (its generation references), forbidden by independent, optional on a chained mode (the set a re-anchor and the join QC compare against).",
              "$ref": "common.schema.json#/$defs/IdentityReferenceSet"
            },
            "chain_depth": {
              "$ref": "common.schema.json#/$defs/ChainDepth"
            }
          },
          "allOf": [
            {
              "if": {
                "properties": {
                  "mode": {
                    "enum": [
                      "last_frame_chain",
                      "native_extension"
                    ]
                  }
                },
                "required": [
                  "mode"
                ]
              },
              "then": {
                "required": [
                  "predecessor_generation_shot_id"
                ],
                "properties": {
                  "chain_depth": {
                    "minimum": 1
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "mode": {
                    "enum": [
                      "independent",
                      "reference_guided"
                    ]
                  }
                },
                "required": [
                  "mode"
                ]
              },
              "then": {
                "not": {
                  "required": [
                    "predecessor_generation_shot_id"
                  ]
                },
                "properties": {
                  "chain_depth": {
                    "const": 0
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "mode": {
                    "const": "reference_guided"
                  }
                },
                "required": [
                  "mode"
                ]
              },
              "then": {
                "required": [
                  "identity_reference_set"
                ]
              }
            },
            {
              "if": {
                "properties": {
                  "mode": {
                    "const": "independent"
                  }
                },
                "required": [
                  "mode"
                ]
              },
              "then": {
                "not": {
                  "required": [
                    "identity_reference_set"
                  ]
                }
              }
            }
          ]
        }
      }
    }
  },
  "continuity-report.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/continuity/v1/continuity-report.schema.json",
    "title": "continuity_report_v1",
    "description": "The verdict of validating a continuity plan or a continuation manifest (P05-01). Issues come in the fixed order of continuity-rules.json `issue_order` (then in document order) and every issue blocks: a report with any issue is invalid. An unsupported continuity mode is a refusal that names the modes the model does support (`supported_modes`); the shot's mode is never silently replaced by one of them. The report names ids only: no prompt text, no handle, no URL.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "verdict",
      "issues"
    ],
    "properties": {
      "schema_version": {
        "const": "continuity_report_v1"
      },
      "verdict": {
        "enum": [
          "valid",
          "invalid"
        ]
      },
      "issues": {
        "type": "array",
        "maxItems": 200,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "code",
            "generation_shot_id"
          ],
          "properties": {
            "code": {
              "$ref": "common.schema.json#/$defs/IssueCode"
            },
            "generation_shot_id": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/common.schema.json#/$defs/StableId"
            },
            "mode": {
              "$ref": "common.schema.json#/$defs/ContinuityMode"
            },
            "supported_modes": {
              "description": "The modes the shot's model supports, in canonical order (independent is always one of them).",
              "type": "array",
              "minItems": 1,
              "maxItems": 4,
              "uniqueItems": true,
              "contains": {
                "const": "independent"
              },
              "items": {
                "$ref": "common.schema.json#/$defs/ContinuityMode"
              }
            }
          },
          "allOf": [
            {
              "if": {
                "properties": {
                  "code": {
                    "const": "continuity_mode_unsupported"
                  }
                },
                "required": [
                  "code"
                ]
              },
              "then": {
                "required": [
                  "mode",
                  "supported_modes"
                ]
              },
              "else": {
                "not": {
                  "anyOf": [
                    {
                      "required": [
                        "mode"
                      ]
                    },
                    {
                      "required": [
                        "supported_modes"
                      ]
                    }
                  ]
                }
              }
            }
          ]
        }
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "verdict": {
              "const": "valid"
            }
          },
          "required": [
            "verdict"
          ]
        },
        "then": {
          "properties": {
            "issues": {
              "maxItems": 0
            }
          }
        },
        "else": {
          "properties": {
            "issues": {
              "minItems": 1
            }
          }
        }
      }
    ]
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
  "video-preparation/v1/common.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/common.schema.json",
    "title": "video_preparation_common_v1",
    "description": "Shared definitions of the video-preparation v1 package (P04-15 schema part). Not a standalone document type. Ids, hashes, revisions and project ids are owned by assistant-runtime v1 and referenced, never copied.",
    "$defs": {
      "ArtifactKind": {
        "description": "Typed preparation artifact kinds (KARAR-VIDEO-BRIEF-SCRIPT-PLAN-VE-ONAY \u00a74). research_pack is P04-15's addition next to the P00-04 PreparationArtifactRef kinds.",
        "enum": [
          "video_brief",
          "research_pack",
          "script",
          "shot_plan",
          "production_plan"
        ]
      },
      "ArtifactId": {
        "description": "Composition-owned preparation artifact id.",
        "type": "string",
        "pattern": "^vprep_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
      },
      "ArtifactRevisionRef": {
        "description": "Exact immutable revision of one preparation artifact. The digest is the canonical sha256 of the stored body; a ref whose digest does not match the owner's revision is stale.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "artifact_kind",
          "artifact_id",
          "artifact_revision",
          "content_digest_sha256"
        ],
        "properties": {
          "artifact_kind": {
            "$ref": "#/$defs/ArtifactKind"
          },
          "artifact_id": {
            "$ref": "#/$defs/ArtifactId"
          },
          "artifact_revision": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
          },
          "content_digest_sha256": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          }
        }
      },
      "StableId": {
        "description": "Stable chapter/beat/shot/source/claim id; unique inside its artifact, kept across revisions (execution, timeline narration bindings and progress refs use it).",
        "type": "string",
        "pattern": "^[a-z][a-z0-9_-]{0,63}$"
      },
      "Seconds": {
        "description": "Duration in seconds (planned/estimated before TTS, measured after).",
        "type": "number",
        "minimum": 0,
        "maximum": 36000
      },
      "Locale": {
        "type": "string",
        "pattern": "^[a-z]{2,3}(-[A-Z]{2})?$"
      },
      "AspectRatio": {
        "description": "Same set as the Composition project aspect ratio (#294).",
        "enum": [
          "16:9",
          "9:16",
          "1:1"
        ]
      },
      "Credits": {
        "description": "Credit amount (P00-10 precision 0.0001).",
        "type": "number",
        "minimum": 0,
        "multipleOf": 0.0001
      },
      "SectionRole": {
        "description": "Template structure role (KARAR 8C): intro/hook, main chapters, outro/CTA.",
        "enum": [
          "intro",
          "main",
          "outro",
          "cta"
        ]
      },
      "OwnerResourceRef": {
        "description": "Typed owner resource ref used by bindings (avatar/voice/template/element/kit/asset). No universal revision_id: the owner names its own revision.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "owner_bc",
          "resource_kind",
          "resource_id"
        ],
        "properties": {
          "owner_bc": {
            "enum": [
              "avatar",
              "voice",
              "brand",
              "storage",
              "composition",
              "media_catalog"
            ]
          },
          "resource_kind": {
            "description": "P04-19 (additive v1 note R12-4) adds `motion`: a Brand Motion library revision the director resolver pinned.",
            "enum": [
              "avatar",
              "voice",
              "template",
              "intro",
              "outro",
              "element",
              "kit",
              "asset",
              "stock_item",
              "motion"
            ]
          },
          "resource_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "resource_revision": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          }
        }
      },
      "CapabilityRef": {
        "description": "Real Workflow catalog node the shot or operation needs. A name that is not in the tenant's catalog fails the capability validator; nothing is inferred from a product name (K230).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "node_type",
          "capability"
        ],
        "properties": {
          "node_type": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*(@[0-9]+)?$",
            "maxLength": 128
          },
          "capability": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/CapabilityKey"
          },
          "model_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/ModelId"
          }
        }
      },
      "SelectionSource": {
        "description": "Why a binding/value was chosen (KARAR \u00a72 step 1, 8B order).",
        "enum": [
          "explicit",
          "job_selection",
          "template",
          "channel_default",
          "personal_default",
          "product_default",
          "product_suggestion"
        ]
      },
      "Provenance": {
        "description": "How a revision came to be. attached_from is the F23 copy-on-attach source (exact immutable revision; never rewritten by a writer call).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "origin"
        ],
        "properties": {
          "origin": {
            "enum": [
              "agent",
              "user",
              "system",
              "import",
              "attach"
            ]
          },
          "job_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "step_id": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_.:-]{0,127}$"
          },
          "node_result": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "node_type",
              "result_digest_sha256"
            ],
            "properties": {
              "node_type": {
                "type": "string",
                "maxLength": 128
              },
              "result_digest_sha256": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
              }
            }
          },
          "attached_from": {
            "$ref": "#/$defs/AttachSourceRef"
          },
          "change_summary": {
            "type": "string",
            "maxLength": 500
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "origin": {
                  "const": "attach"
                }
              }
            },
            "then": {
              "required": [
                "attached_from"
              ]
            },
            "else": {
              "not": {
                "required": [
                  "attached_from"
                ]
              }
            }
          }
        ]
      },
      "AttachSourceRef": {
        "description": "Exact source revision of an attached script (F23), or of the research pack the attached script cites (copied with it so its claim refs stay exact). owner_bc assistant = standalone script artifact store; composition = another project's artifact.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "owner_bc",
          "artifact_kind",
          "artifact_id",
          "artifact_revision",
          "content_digest_sha256"
        ],
        "properties": {
          "owner_bc": {
            "enum": [
              "assistant",
              "composition"
            ]
          },
          "artifact_kind": {
            "enum": [
              "script",
              "research_pack"
            ]
          },
          "artifact_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "artifact_revision": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
          },
          "content_digest_sha256": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          }
        }
      },
      "ValidatorName": {
        "description": "Server validators of the ready rule (\u00a74 Ready kural\u0131).",
        "enum": [
          "schema",
          "semantic",
          "coverage",
          "timing",
          "capability",
          "estimate"
        ]
      },
      "ValidationIssue": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "validator",
          "code",
          "severity",
          "path"
        ],
        "properties": {
          "validator": {
            "$ref": "#/$defs/ValidatorName"
          },
          "code": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]{0,63}$"
          },
          "severity": {
            "enum": [
              "error",
              "warning"
            ]
          },
          "path": {
            "type": "string",
            "maxLength": 256
          },
          "ref": {
            "type": "string",
            "maxLength": 128
          }
        }
      },
      "Readiness": {
        "description": "draft: saved, not offered for G1 (e.g. outline, estimate pending). not_ready: validation failed. ready: every validator passed. stale: derived at read time when a dependency head moved past the pinned ref.",
        "enum": [
          "draft",
          "not_ready",
          "ready",
          "stale"
        ]
      },
      "QualityTier": {
        "description": "P04-03 (additive v1 note): the Ekonomik/Dengeli/Kalite profile a generation was planned with (KARAR 8F). A label of the owner choice, never a claim that a model is measured best.",
        "enum": [
          "economy",
          "balanced",
          "quality"
        ]
      },
      "TransitionHandles": {
        "description": "P04-03 (additive v1 note): extra generated seconds before/after the usable window that a transition may use; never counted as timeline time.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "in_seconds",
          "out_seconds"
        ],
        "properties": {
          "in_seconds": {
            "type": "number",
            "minimum": 0,
            "maximum": 10
          },
          "out_seconds": {
            "type": "number",
            "minimum": 0,
            "maximum": 10
          }
        }
      },
      "NarratorTiming": {
        "description": "P04-03 (additive v1 note): where the shot's narration is spoken inside the shot, relative to the shot start. `estimated` before TTS (speech-rate basis); `measured` only after the real TTS/alignment (P04-07).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "start_seconds",
          "end_seconds",
          "basis"
        ],
        "properties": {
          "start_seconds": {
            "$ref": "#/$defs/Seconds"
          },
          "end_seconds": {
            "$ref": "#/$defs/Seconds"
          },
          "basis": {
            "enum": [
              "estimated",
              "measured"
            ]
          }
        }
      },
      "OperationId": {
        "description": "P04-15 compiler (additive v1 note): id of one compiled logical operation, sha256-derived from job + operation key + input hash (a changed input is a new operation; a recovery of the same operation keeps its id). Matches the P03-06 production operation id pattern.",
        "type": "string",
        "pattern": "^vop_[a-f0-9]{32}$"
      },
      "GeneratedTakeRef": {
        "description": "P04-03 (additive v1 note) F21 GeneratedTake identity: one result of one GenerationShot attempt. take_id = '<generation_shot_id>-t<attempt>' (preparation-rules.json derivation_rules). Produced by execution (P04-08); a new user take is a new attempt, a recovery of the same operation keeps its attempt.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "take_id",
          "generation_shot_id",
          "attempt"
        ],
        "properties": {
          "take_id": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_-]{0,63}-t[0-9]{1,3}$"
          },
          "generation_shot_id": {
            "$ref": "#/$defs/StableId"
          },
          "attempt": {
            "type": "integer",
            "minimum": 1,
            "maximum": 100
          },
          "operation_id": {
            "$ref": "#/$defs/OperationId"
          }
        }
      },
      "ClipInstanceTarget": {
        "description": "P04-03 (additive v1 note) F21 ClipInstance target: the plan scene and its typed layer that a take or a reused asset fills (materialized as a Composition clip layer through the P03-06 production binding).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "scene_id",
          "layer_key"
        ],
        "properties": {
          "scene_id": {
            "$ref": "#/$defs/StableId"
          },
          "layer_key": {
            "$ref": "#/$defs/StableId"
          }
        }
      }
    }
  }
} as const;

export const DOCUMENT_TYPES = ["continuation-manifest", "continuity-plan", "continuity-report"] as const;
export type DocumentType = "continuation-manifest" | "continuity-plan" | "continuity-report";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "continuation-manifest": [
    "continuation_manifest_v1"
  ],
  "continuity-plan": [
    "continuity_plan_v1"
  ],
  "continuity-report": [
    "continuity_report_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {};

export type ContinuationManifest = {
    readonly "schema_version": "continuation_manifest_v1";
    readonly "job_id": unknown;
    readonly "take": unknown;
    readonly "mode": "independent" | "reference_guided" | "last_frame_chain" | "native_extension";
    readonly "continued_from"?: {
    readonly "previous_take": unknown;
    readonly "previous_output_sha256": unknown;
    readonly "anchor_frame"?: unknown;
    readonly "provider_handle"?: {
    readonly "handle_sha256": unknown;
    readonly "expires_at": unknown;
  };
  };
    readonly "identity_reference_set"?: unknown;
    readonly "scene_notes"?: {
    readonly "location"?: string;
    readonly "light"?: string;
    readonly "camera"?: string;
  };
    readonly "model_id": unknown;
    readonly "prompt_sha256": unknown;
    readonly "seed": {
    readonly "value"?: number;
    readonly "seed_is_guarantee": false;
  };
    readonly "chain_depth": number;
    readonly "qc": {
    readonly "profile": unknown;
    readonly "status": "not_run" | "passed" | "failed" | "uncertain";
  };
    readonly "created_at": unknown;
  };
export type ContinuityPlan = {
    readonly "schema_version": "continuity_plan_v1";
    readonly "job_id": unknown;
    readonly "shot_plan_ref": (unknown) & ({
    readonly "artifact_kind"?: "shot_plan";
  });
    readonly "max_chain_depth": number;
    readonly "generation_shots": readonly ({
    readonly "generation_shot_id": unknown;
    readonly "mode": "independent" | "reference_guided" | "last_frame_chain" | "native_extension";
    readonly "capability": unknown;
    readonly "predecessor_generation_shot_id"?: unknown;
    readonly "identity_reference_set"?: unknown;
    readonly "chain_depth": number;
  })[];
  };
export type ContinuityReport = {
    readonly "schema_version": "continuity_report_v1";
    readonly "verdict": "valid" | "invalid";
    readonly "issues": readonly ({
    readonly "code": "continuity_mode_unsupported" | "reference_set_exceeds_model_limit" | "duplicate_generation_shot_id" | "predecessor_unknown" | "chain_cycle" | "chain_depth_mismatch" | "chain_depth_exceeds_max" | "take_identity_invalid" | "manifest_continues_own_shot" | "provider_handle_expired" | "manifest_job_mismatch" | "manifest_shot_unknown" | "manifest_mode_mismatch" | "manifest_predecessor_mismatch" | "manifest_chain_depth_mismatch" | "manifest_model_mismatch" | "manifest_identity_set_mismatch";
    readonly "generation_shot_id": unknown;
    readonly "mode"?: "independent" | "reference_guided" | "last_frame_chain" | "native_extension";
    readonly "supported_modes"?: readonly ("independent" | "reference_guided" | "last_frame_chain" | "native_extension")[];
  })[];
  };

export const reader = new ContractPackageReader({
  package: "continuity",
  schemas: { ...SCHEMAS, ...DEPENDENCY_SCHEMAS } as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
