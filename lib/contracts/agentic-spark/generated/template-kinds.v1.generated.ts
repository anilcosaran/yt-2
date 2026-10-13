// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/template-kinds/v1
//
// Every exported `<Stem>` type is a best-effort structural sketch for editor
// ergonomics only. Keywords that constrain values without changing shape
// (if/then/else, allOf, not, dependentRequired, pattern, format, min/max,
// multipleOf) are enforced by `read()` against SCHEMAS below, not by these
// static types -- a value can satisfy a type here and still be rejected by
// `read()`. Treat `read()` as authoritative.

import { ContractPackageReader } from "./runtime.generated";

export const SCHEMAS = {
  "channel-template-binding.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/template-kinds/v1/channel-template-binding.schema.json",
    "title": "channel_template_binding_v1",
    "description": "The outcome of choosing the Video Template of a job when a channel or personal rule may name one (\"haber videolar\u0131nda @HaberB\u00fclteni kullan\", KARAR-VIDEO-BRIEF-SCRIPT-PLAN-VE-ONAY SS8B; P06-56; K309). The channel layer is no new entity: the rules are the actor's own and channel-scope PersonalInstruction preferences (P01B-03); this document only records which template was chosen and why. Order: the job's explicit mention, then the job's own selection, then the matching rules (project before channel before personal; a content-type rule before a general one). Two equally ranked rules never pick silently (selection_required); a chosen rule whose template is deleted, revoked, archived or does not fit is `unavailable` (\"Se\u00e7im gerekli / Kullan\u0131lam\u0131yor\") and never falls back to another template. A template chosen for this job alone never writes a rule: `save_suggestion` only offers the explicit \"Bu t\u00fcr videolarda kullan\" action.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "status",
      "candidates",
      "save_suggestion"
    ],
    "properties": {
      "schema_version": {
        "const": "channel_template_binding_v1"
      },
      "status": {
        "enum": [
          "explicit",
          "job_selection",
          "rule_applied",
          "none",
          "selection_required",
          "unavailable"
        ]
      },
      "template_ref": {
        "allOf": [
          {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/BrandRevisionRef"
          },
          {
            "properties": {
              "brand_asset_kind": {
                "const": "template"
              }
            }
          }
        ]
      },
      "selection_source": {
        "enum": [
          "explicit",
          "job_selection",
          "channel_default",
          "personal_default"
        ]
      },
      "rule_ref": {
        "description": "The PersonalInstruction the template came from (opaque id).",
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "matched_condition": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "content_types",
          "project_id"
        ],
        "properties": {
          "content_types": {
            "type": "array",
            "maxItems": 8,
            "uniqueItems": true,
            "items": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_-]{0,47}$"
            }
          },
          "project_id": {
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
      "approval": {
        "description": "How the applied rule reaches the job: pre-selected on the Plan card for the user's approval, or applied by Auto within its grant.",
        "enum": [
          "plan_card",
          "auto"
        ]
      },
      "candidates": {
        "description": "Every rule that was looked at, in evaluation order (highest rank first).",
        "type": "array",
        "maxItems": 40,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "rule_ref",
            "scope",
            "specificity",
            "outcome"
          ],
          "properties": {
            "rule_ref": {
              "$ref": "common.schema.json#/$defs/OpaqueId"
            },
            "scope": {
              "$ref": "common.schema.json#/$defs/RuleScope"
            },
            "specificity": {
              "enum": [
                "content_type",
                "general"
              ]
            },
            "outcome": {
              "description": "selected: the rule that applied; tied: equally ranked with another (a question is due); superseded: matched but a higher rank won; not_matching: the condition does not hold for this job; unavailable: its template cannot be used.",
              "enum": [
                "selected",
                "tied",
                "superseded",
                "not_matching",
                "unavailable"
              ]
            },
            "reason": {
              "$ref": "common.schema.json#/$defs/UnavailableReason"
            }
          }
        }
      },
      "unavailable_reason": {
        "$ref": "common.schema.json#/$defs/UnavailableReason"
      },
      "question": {
        "description": "selection_required: one small question between the tied rules (no random pick).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "code",
          "rule_refs"
        ],
        "properties": {
          "code": {
            "const": "template_rule_conflict"
          },
          "rule_refs": {
            "type": "array",
            "minItems": 2,
            "maxItems": 4,
            "uniqueItems": true,
            "items": {
              "$ref": "common.schema.json#/$defs/OpaqueId"
            }
          }
        }
      },
      "save_suggestion": {
        "type": "boolean"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "status": {
              "enum": [
                "explicit",
                "job_selection",
                "rule_applied"
              ]
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "required": [
            "template_ref",
            "selection_source"
          ]
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "explicit"
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "properties": {
            "selection_source": {
              "const": "explicit"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "job_selection"
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "properties": {
            "selection_source": {
              "const": "job_selection"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "rule_applied"
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "required": [
            "rule_ref",
            "matched_condition",
            "approval"
          ],
          "properties": {
            "selection_source": {
              "enum": [
                "channel_default",
                "personal_default"
              ]
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "selection_required"
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "required": [
            "question"
          ],
          "not": {
            "required": [
              "template_ref"
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "unavailable"
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "required": [
            "unavailable_reason",
            "rule_ref"
          ],
          "not": {
            "required": [
              "template_ref"
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "none"
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "not": {
            "required": [
              "template_ref"
            ]
          }
        }
      }
    ]
  },
  "common.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/template-kinds/v1/common.schema.json",
    "title": "template_kinds_common_v1",
    "description": "Shared definitions of the P06-56 template kinds package (KARAR-ANLATIM-YERLESIM-KONUSMACI-VE-SABLONLAR SS9, Q48; K308/K309): the seven production kinds of a Video Template, the slot roles the engine places media and text by, the typed slot bindings of a fill and the placement, question and unavailability vocabularies. Not a standalone document type.",
    "$defs": {
      "TemplateType": {
        "description": "The production kind of a Video Template (brand_template_manifest_v2.template_type; motion-spark v1 canonical-enums.json template_types). The kind is a label of the P06-03 model; template-kind-rules.json gives it its meaning.",
        "enum": [
          "tanitim_motion_film",
          "slayt_egitim",
          "konsept_video",
          "program_formati",
          "ham_video_formati",
          "sosyal_kanvas_dikey",
          "yorum_tepki_derleme"
        ]
      },
      "SlotRole": {
        "description": "brand_template_manifest_v2 SlotRole (P06-56 additive optional slot field). Media roles: host, main, item, reaction, background, frame, logo, b_roll. Text roles: title, subtitle, hook, headline, body, comment, attribution, cta.",
        "enum": [
          "host",
          "main",
          "item",
          "reaction",
          "background",
          "frame",
          "logo",
          "b_roll",
          "title",
          "subtitle",
          "hook",
          "headline",
          "body",
          "comment",
          "attribution",
          "cta"
        ]
      },
      "SlotLocalId": {
        "description": "Stable local slot id of a template revision (brand-template v1 LocalId).",
        "type": "string",
        "maxLength": 64,
        "pattern": "^[a-z][a-z0-9_]*(\\.[a-z0-9_]+)*$"
      },
      "SectionLocalId": {
        "description": "Stable local section id of a template revision (brand-template v1 LocalId).",
        "type": "string",
        "maxLength": 64,
        "pattern": "^[a-z][a-z0-9_]*(\\.[a-z0-9_]+)*$"
      },
      "OpaqueId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
      },
      "ValueKind": {
        "enum": [
          "video",
          "image",
          "audio",
          "text"
        ]
      },
      "HostMode": {
        "description": "Programme format presenter mode: a generated avatar (a planned paid line) or the user's real-person video (a template slot filled with media; nothing is generated). Switching it never changes the saved template.",
        "enum": [
          "avatar",
          "real_video"
        ]
      },
      "Binding": {
        "description": "One typed slot binding exactly as the template compile takes it (`POST .../instances` bindings): a media source of the project or a verbatim text. Text is never edited, shortened or rephrased by the engine.",
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "source_id"
            ],
            "properties": {
              "kind": {
                "const": "video"
              },
              "source_id": {
                "$ref": "#/$defs/OpaqueId"
              },
              "source_range": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "in_tick",
                  "out_tick"
                ],
                "properties": {
                  "in_tick": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "out_tick": {
                    "type": "integer",
                    "minimum": 1
                  }
                }
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "source_id"
            ],
            "properties": {
              "kind": {
                "enum": [
                  "image",
                  "audio"
                ]
              },
              "source_id": {
                "$ref": "#/$defs/OpaqueId"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "text"
            ],
            "properties": {
              "kind": {
                "const": "text"
              },
              "text": {
                "type": "string",
                "minLength": 1,
                "maxLength": 2000
              }
            }
          }
        ]
      },
      "PlacementReason": {
        "description": "Why a value stands in a slot: role_hint / slot_hint (the mention named a role or a slot), required_single (a required one-value slot took the next media), repeat_driver (a repeatable section's driver slot, one repeat per media), optional_single (a leftover went to an optional slot), verbatim_text (the user's own text), model_text (a text the selected model wrote inside the kind's rules, only where the user gave none; a comment is fictional), program_item (a programme item), host_real_video (the presenter slot filled with the user's video).",
        "enum": [
          "role_hint",
          "slot_hint",
          "required_single",
          "repeat_driver",
          "optional_single",
          "verbatim_text",
          "model_text",
          "program_item",
          "host_real_video"
        ]
      },
      "UnplacedReason": {
        "description": "Why a mention was left out: over_capacity (the template takes fewer of that kind), no_slot_for_kind, role_unknown (no slot has the named role or id), role_mismatch (the slot or role is of another value kind), text_too_long (longer than the slot allows; never truncated), text_empty (no characters after Unicode NFC and edge whitespace normalisation, exactly as the compile normalises; nothing to bind), repeat_gap (a list binding cannot skip a repeat: a later repeat's value is not shifted onto an earlier one).",
        "enum": [
          "over_capacity",
          "no_slot_for_kind",
          "role_unknown",
          "role_mismatch",
          "text_too_long",
          "text_empty",
          "repeat_gap"
        ]
      },
      "QuestionCode": {
        "description": "One concrete question the assistant may ask: media_over_capacity (more media than the template takes), repeat_min_unmet, repeat_max_exceeded, required_slot_unfilled, text_too_long, multi_value_slot_unsupported (a non-repeating slot of cardinality above 1 takes one value), text_role_unknown, items_exceed_max, items_below_min, repeat_slot_gap (an optional slot of a repeated scene has a value for some items but not for all: a list binding cannot skip a repeat, so it is bound for every item or none).",
        "enum": [
          "media_over_capacity",
          "repeat_min_unmet",
          "repeat_max_exceeded",
          "required_slot_unfilled",
          "text_too_long",
          "multi_value_slot_unsupported",
          "text_role_unknown",
          "items_exceed_max",
          "items_below_min",
          "repeat_slot_gap"
        ]
      },
      "PendingReason": {
        "enum": [
          "media_needed",
          "text_needed"
        ]
      },
      "RuleScope": {
        "description": "project: the rule names this project; channel: a channel-scope PersonalInstruction; personal: the actor's own rule.",
        "enum": [
          "project",
          "channel",
          "personal"
        ]
      },
      "UnavailableReason": {
        "description": "Why the template a rule names cannot be used: not_found (deleted or never usable), revoked (access withdrawn), archived, ratio_unsupported (the job's aspect ratio is not supported), capacity_exceeded (the items do not fit the template's repeat bounds).",
        "enum": [
          "not_found",
          "revoked",
          "archived",
          "ratio_unsupported",
          "capacity_exceeded"
        ]
      }
    }
  },
  "template-fill-plan.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/template-kinds/v1/template-fill-plan.schema.json",
    "title": "template_fill_plan_v1",
    "description": "The deterministic result of filling a Video Template revision with what the user mentioned (P06-56; KARAR-ANLATIM-YERLESIM-KONUSMACI-VE-SABLONLAR SS9; K308/K309): @mention media are placed by role and cardinality into the slots, a repeatable section opens once per media (or programme item), the user's text stays verbatim, everything the template cannot take is listed instead of dropped silently. `bindings` are the normalized typed bindings (the `normalized_bindings` the template compile returns; the raw request body of `POST /api/v1/composition-templates/projects/{id}/instances` is the same list without the `kind` discriminator) and `choices` the instance choices; the saved template is never changed. Programme formats add the item sections, the presenter mode and the planned lines (voice-over per item, an avatar line only in avatar mode).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "rules_revision",
      "template_type",
      "bindings",
      "choices",
      "placements",
      "repeats",
      "unplaced",
      "questions",
      "pending_slots",
      "final_ready"
    ],
    "properties": {
      "schema_version": {
        "const": "template_fill_plan_v1"
      },
      "rules_revision": {
        "type": "integer",
        "minimum": 1
      },
      "template_type": {
        "$ref": "common.schema.json#/$defs/TemplateType"
      },
      "bindings": {
        "description": "`{ slot_id: binding[] }`; a repeatable section's slot takes one value per repeat (list index = repeat index), any other slot one value.",
        "type": "object",
        "maxProperties": 64,
        "propertyNames": {
          "$ref": "common.schema.json#/$defs/SlotLocalId"
        },
        "additionalProperties": {
          "type": "array",
          "minItems": 1,
          "maxItems": 20,
          "items": {
            "$ref": "common.schema.json#/$defs/Binding"
          }
        }
      },
      "choices": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "sections": {
            "type": "object",
            "maxProperties": 16,
            "propertyNames": {
              "$ref": "common.schema.json#/$defs/SectionLocalId"
            },
            "additionalProperties": {
              "type": "boolean"
            }
          },
          "repeats": {
            "type": "object",
            "maxProperties": 16,
            "propertyNames": {
              "$ref": "common.schema.json#/$defs/SectionLocalId"
            },
            "additionalProperties": {
              "type": "integer",
              "minimum": 0,
              "maximum": 20
            }
          },
          "options": {
            "type": "object",
            "maxProperties": 16,
            "propertyNames": {
              "$ref": "common.schema.json#/$defs/SectionLocalId"
            },
            "additionalProperties": {
              "type": "boolean"
            }
          }
        }
      },
      "placements": {
        "type": "array",
        "maxItems": 200,
        "items": {
          "$ref": "#/$defs/Placement"
        }
      },
      "repeats": {
        "type": "array",
        "maxItems": 16,
        "items": {
          "$ref": "#/$defs/Repeat"
        }
      },
      "unplaced": {
        "type": "array",
        "maxItems": 100,
        "items": {
          "$ref": "#/$defs/Unplaced"
        }
      },
      "questions": {
        "type": "array",
        "maxItems": 20,
        "items": {
          "$ref": "#/$defs/Question"
        }
      },
      "pending_slots": {
        "type": "array",
        "maxItems": 200,
        "items": {
          "$ref": "#/$defs/PendingSlot"
        }
      },
      "final_ready": {
        "description": "No required slot is unfilled and no repeat bound is unmet; pending optional slots do not block. Preview may always run.",
        "type": "boolean"
      },
      "program": {
        "$ref": "#/$defs/Program"
      }
    },
    "$defs": {
      "Placement": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "slot_id",
          "section_local_id",
          "repeat_index",
          "role",
          "value_kind",
          "reason"
        ],
        "properties": {
          "slot_id": {
            "$ref": "common.schema.json#/$defs/SlotLocalId"
          },
          "section_local_id": {
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/SectionLocalId"
              },
              {
                "type": "null"
              }
            ]
          },
          "repeat_index": {
            "type": "integer",
            "minimum": 0,
            "maximum": 19
          },
          "role": {
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/SlotRole"
              },
              {
                "type": "null"
              }
            ]
          },
          "value_kind": {
            "$ref": "common.schema.json#/$defs/ValueKind"
          },
          "source_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "mention_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "reason": {
            "$ref": "common.schema.json#/$defs/PlacementReason"
          }
        }
      },
      "Repeat": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "section_local_id",
          "count",
          "min",
          "max",
          "driver_slot_id"
        ],
        "properties": {
          "section_local_id": {
            "$ref": "common.schema.json#/$defs/SectionLocalId"
          },
          "count": {
            "type": "integer",
            "minimum": 0,
            "maximum": 20
          },
          "min": {
            "type": "integer",
            "minimum": 0,
            "maximum": 20
          },
          "max": {
            "type": "integer",
            "minimum": 1,
            "maximum": 20
          },
          "driver_slot_id": {
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/SlotLocalId"
              },
              {
                "type": "null"
              }
            ]
          }
        }
      },
      "Unplaced": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "mention_id",
          "value_kind",
          "reason"
        ],
        "properties": {
          "mention_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "value_kind": {
            "$ref": "common.schema.json#/$defs/ValueKind"
          },
          "reason": {
            "$ref": "common.schema.json#/$defs/UnplacedReason"
          }
        }
      },
      "Question": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "code"
        ],
        "properties": {
          "code": {
            "$ref": "common.schema.json#/$defs/QuestionCode"
          },
          "slot_id": {
            "$ref": "common.schema.json#/$defs/SlotLocalId"
          },
          "section_local_id": {
            "$ref": "common.schema.json#/$defs/SectionLocalId"
          },
          "detail": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          }
        }
      },
      "PendingSlot": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "slot_id",
          "section_local_id",
          "repeat_index",
          "role",
          "value_kind",
          "reason",
          "required"
        ],
        "properties": {
          "slot_id": {
            "$ref": "common.schema.json#/$defs/SlotLocalId"
          },
          "section_local_id": {
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/SectionLocalId"
              },
              {
                "type": "null"
              }
            ]
          },
          "repeat_index": {
            "type": "integer",
            "minimum": 0,
            "maximum": 19
          },
          "role": {
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/SlotRole"
              },
              {
                "type": "null"
              }
            ]
          },
          "value_kind": {
            "$ref": "common.schema.json#/$defs/ValueKind"
          },
          "reason": {
            "$ref": "common.schema.json#/$defs/PendingReason"
          },
          "required": {
            "description": "The slot is required: a required pending slot keeps the plan from being final-ready.",
            "type": "boolean"
          }
        }
      },
      "Program": {
        "description": "Programme format (K308): one section per item, the presenter mode and the planned lines that flow into the single Plan view and G1.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "item_count",
          "host",
          "sections",
          "plan_lines"
        ],
        "properties": {
          "item_count": {
            "type": "integer",
            "minimum": 0,
            "maximum": 20
          },
          "host": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "mode",
              "slot_id"
            ],
            "properties": {
              "mode": {
                "$ref": "common.schema.json#/$defs/HostMode"
              },
              "slot_id": {
                "description": "The presenter slot; null when the template has none.",
                "oneOf": [
                  {
                    "$ref": "common.schema.json#/$defs/SlotLocalId"
                  },
                  {
                    "type": "null"
                  }
                ]
              }
            }
          },
          "sections": {
            "type": "array",
            "maxItems": 16,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "section_local_id",
                "count"
              ],
              "properties": {
                "section_local_id": {
                  "$ref": "common.schema.json#/$defs/SectionLocalId"
                },
                "count": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 20
                }
              }
            }
          },
          "plan_lines": {
            "description": "The planned lines the plan prices: narration (voice-over of an item's text) and host_video (one avatar clip, only in avatar mode with a presenter slot).",
            "type": "array",
            "maxItems": 40,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "kind",
                "section_local_id",
                "repeat_index",
                "slot_id"
              ],
              "properties": {
                "kind": {
                  "enum": [
                    "narration",
                    "host_video"
                  ]
                },
                "section_local_id": {
                  "oneOf": [
                    {
                      "$ref": "common.schema.json#/$defs/SectionLocalId"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "repeat_index": {
                  "oneOf": [
                    {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 19
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "slot_id": {
                  "oneOf": [
                    {
                      "$ref": "common.schema.json#/$defs/SlotLocalId"
                    },
                    {
                      "type": "null"
                    }
                  ]
                }
              }
            }
          }
        }
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

export const DOCUMENT_TYPES = ["channel-template-binding", "template-fill-plan"] as const;
export type DocumentType = "channel-template-binding" | "template-fill-plan";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "channel-template-binding": [
    "channel_template_binding_v1"
  ],
  "template-fill-plan": [
    "template_fill_plan_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {
  "channel-template-binding": {
    "status": [
      "explicit",
      "job_selection",
      "none",
      "rule_applied",
      "selection_required",
      "unavailable"
    ]
  }
};

export type ChannelTemplateBinding = {
    readonly "schema_version": "channel_template_binding_v1";
    readonly "status": "explicit" | "job_selection" | "rule_applied" | "none" | "selection_required" | "unavailable";
    readonly "template_ref"?: (unknown) & ({
    readonly "brand_asset_kind"?: "template";
  });
    readonly "selection_source"?: "explicit" | "job_selection" | "channel_default" | "personal_default";
    readonly "rule_ref"?: string;
    readonly "matched_condition"?: {
    readonly "content_types": readonly (string)[];
    readonly "project_id": (string) | (null);
  };
    readonly "approval"?: "plan_card" | "auto";
    readonly "candidates": readonly ({
    readonly "rule_ref": string;
    readonly "scope": "project" | "channel" | "personal";
    readonly "specificity": "content_type" | "general";
    readonly "outcome": "selected" | "tied" | "superseded" | "not_matching" | "unavailable";
    readonly "reason"?: "not_found" | "revoked" | "archived" | "ratio_unsupported" | "capacity_exceeded";
  })[];
    readonly "unavailable_reason"?: "not_found" | "revoked" | "archived" | "ratio_unsupported" | "capacity_exceeded";
    readonly "question"?: {
    readonly "code": "template_rule_conflict";
    readonly "rule_refs": readonly (string)[];
  };
    readonly "save_suggestion": boolean;
  };
export type TemplateFillPlan = {
    readonly "schema_version": "template_fill_plan_v1";
    readonly "rules_revision": number;
    readonly "template_type": "tanitim_motion_film" | "slayt_egitim" | "konsept_video" | "program_formati" | "ham_video_formati" | "sosyal_kanvas_dikey" | "yorum_tepki_derleme";
    readonly "bindings": Record<string, unknown>;
    readonly "choices": {
    readonly "sections"?: Record<string, unknown>;
    readonly "repeats"?: Record<string, unknown>;
    readonly "options"?: Record<string, unknown>;
  };
    readonly "placements": readonly (unknown)[];
    readonly "repeats": readonly (unknown)[];
    readonly "unplaced": readonly (unknown)[];
    readonly "questions": readonly (unknown)[];
    readonly "pending_slots": readonly (unknown)[];
    readonly "final_ready": boolean;
    readonly "program"?: unknown;
  };

export const reader = new ContractPackageReader({
  package: "template-kinds",
  schemas: { ...SCHEMAS, ...DEPENDENCY_SCHEMAS } as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
