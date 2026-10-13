// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/overlay-rules/v1
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
    "$id": "https://youtorch.local/contracts/agentic-spark/overlay-rules/v1/common.schema.json",
    "title": "overlay_rules_common_v1",
    "description": "Shared definitions of the P06-55 overlay rules package (KARAR-ANLATIM-YERLESIM-KONUSMACI-VE-SABLONLAR SS8, Q49, Q106, TK-27): the layer kinds a template or a channel preference may define, the named PresenterLayout regions they sit in, the visual reference, the origin of a rule and the drop vocabulary of the overlay plan. Not a standalone document type.",
    "$defs": {
      "LayerKind": {
        "description": "speaker_card: optional speaker introduction card; cta: subscribe/like card bound to the spoken word; section_title: title at a section boundary (at most 2.5 s); badge: persistent corner badge. A layer that no rule defines is never added (Q106).",
        "enum": [
          "speaker_card",
          "cta",
          "section_title",
          "badge"
        ]
      },
      "RegionName": {
        "description": "lower_third, cta and corner_badge are the PresenterLayout regions of P06-53 (aligned to the person's camera region in multi-camera layouts); camera_top is the strip above a camera region that the overlay engine derives as the alternate of the lower third.",
        "enum": [
          "lower_third",
          "cta",
          "corner_badge",
          "camera_top"
        ]
      },
      "RegionRef": {
        "description": "One placement region of one frame's layout: the named region, the camera it belongs to (multi-camera layouts) and whether it is mirrored to the opposite side of the canvas (the region-change step of the conflict order).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "name",
          "mirrored"
        ],
        "properties": {
          "name": {
            "$ref": "#/$defs/RegionName"
          },
          "camera_index": {
            "type": "integer",
            "minimum": 0,
            "maximum": 3
          },
          "mirrored": {
            "type": "boolean"
          }
        }
      },
      "RuleOrigin": {
        "description": "Where the effective rule of a layer came from. Precedence per layer: the user's request of this job, then the selected template's overlay_rules, then the channel preference. Layers are replaced as a whole, never merged field by field.",
        "enum": [
          "user_request",
          "template",
          "channel_preference"
        ]
      },
      "Decider": {
        "description": "rule: the deterministic engine (spoken CTA word, section start, persistent badge); model: the selected model proposed the interval and the engine validated it; user: the user named the time (a CTA at an exact second).",
        "enum": [
          "rule",
          "model",
          "user"
        ]
      },
      "SpeakerLabel": {
        "description": "Stable per-source speaker label S1, S2, ... (multi-speaker v1 SpeakerLabel).",
        "type": "string",
        "pattern": "^S[1-9][0-9]?$"
      },
      "IdentitySource": {
        "description": "Where a card's name came from. Only the user or a confirmed suggestion ever reaches a card; an unconfirmed transcript suggestion (\"ben X\") and an unknown name never do (nothing is invented).",
        "enum": [
          "user",
          "confirmed_suggestion"
        ]
      },
      "CtaPosition": {
        "description": "Fixed CTA positions (Q106 start / middle / end plus the template policy): start = the earliest allowed time, percent_25 = 25 % of the duration, middle = 50 %, before_outro = just before the outro section starts (the end when there is none), end = shortly before the end.",
        "enum": [
          "start",
          "percent_25",
          "middle",
          "before_outro",
          "end"
        ]
      },
      "WordId": {
        "description": "Word id of the exact transcript revision (P03-22/P06-08): w_<index>.",
        "type": "string",
        "pattern": "^w_(0|[1-9][0-9]{0,5})$"
      },
      "Frame": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100000000
      },
      "Seconds": {
        "type": "number",
        "minimum": 0,
        "maximum": 86400
      },
      "Label": {
        "type": "string",
        "minLength": 1,
        "maxLength": 120
      },
      "VisualRef": {
        "description": "The visual part of a layer (KARAR SS8 \"Nerede tanimlanir\"): the platform's standard card that slides up from the bottom (the Q106 default) or an exact Brand Element/Motion revision (the P06-06 seeds are patterns of the same library). The rules never carry raw layer code.",
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind"
            ],
            "properties": {
              "kind": {
                "const": "standard_card"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "ref"
            ],
            "properties": {
              "kind": {
                "const": "brand_ref"
              },
              "ref": {
                "allOf": [
                  {
                    "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/BrandRevisionRef"
                  },
                  {
                    "properties": {
                      "brand_asset_kind": {
                        "enum": [
                          "element",
                          "motion"
                        ]
                      }
                    }
                  }
                ]
              }
            }
          }
        ]
      },
      "DropReason": {
        "description": "Why a proposed layer instance was not added. identity_unknown: Auto with no name (a note goes to Varsayimlarim); identity_pending: Ask asked for the name; frequency_cap: more than the per-person count; no_valid_window / insufficient_face_samples: no window passed the face-track validation (the card never shows unverified); negated_sentence / too_early / too_close / count_cap: the CTA rules; no_cta_position: no phrase and no position; conflict_lower_priority: lost the region-change, +-2 s shift order to a higher priority layer; outside_timeline: the proposal is outside the timeline; no_section_text: the section has no title.",
        "enum": [
          "identity_unknown",
          "identity_pending",
          "frequency_cap",
          "no_valid_window",
          "insufficient_face_samples",
          "negated_sentence",
          "too_early",
          "too_close",
          "count_cap",
          "no_cta_position",
          "conflict_lower_priority",
          "outside_timeline",
          "no_section_text"
        ]
      },
      "ShiftReason": {
        "description": "face_validation: the engine moved the window inside the model's interval until every frame passed; conflict: the +-2 s shift step of the priority conflict order.",
        "enum": [
          "face_validation",
          "conflict"
        ]
      }
    }
  },
  "overlay-plan.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/overlay-rules/v1/overlay-plan.schema.json",
    "title": "overlay_plan_v1",
    "description": "The deterministic result of the overlay rule engine over one LayoutTimeline (P06-53), the speakers and their names, the transcript words and the section boundaries (P06-55; KARAR-ANLATIM-YERLESIM-KONUSMACI-VE-SABLONLAR SS8; K306/K307). Placements are the layers that will be shown, frame exact on the project timeline: speaker cards validated frame by frame against the layout and the face tracks at least 5 fps (TK-27), CTA cards bound to the spoken word, section titles and the corner badge, resolved in the priority order caption > face > speaker card > section title > CTA > badge by first changing the region, then shifting +-2 s, then dropping with a reason. Dropped layers, the identity questions of Ask and the Varsayimlarim notes of Auto travel with the plan; nothing is invented. Placements carry identifiers, frames and the card text the user supplied or confirmed, never raw layer code.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "rules_revision",
      "fps",
      "duration_frames",
      "rules_sha256",
      "limits",
      "placements",
      "dropped",
      "identity_requests",
      "assumptions",
      "qc",
      "plan_sha256"
    ],
    "properties": {
      "schema_version": {
        "const": "overlay_plan_v1"
      },
      "rules_revision": {
        "description": "overlay-rules.json rules_revision the engine ran with.",
        "type": "integer",
        "minimum": 1
      },
      "fps": {
        "type": "number",
        "exclusiveMinimum": 0,
        "maximum": 240
      },
      "duration_frames": {
        "type": "integer",
        "minimum": 1,
        "maximum": 100000000
      },
      "layout_timeline_sha256": {
        "description": "timeline_sha256 of the P06-53 LayoutTimeline the faces were validated against.",
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
      },
      "rules_sha256": {
        "description": "Digest of the effective rule set (per layer origin + values); a changed rule makes the plan stale.",
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
      },
      "limits": {
        "$ref": "#/$defs/Limits"
      },
      "placements": {
        "type": "array",
        "maxItems": 400,
        "items": {
          "$ref": "#/$defs/Placement"
        }
      },
      "dropped": {
        "type": "array",
        "maxItems": 400,
        "items": {
          "$ref": "#/$defs/Dropped"
        }
      },
      "identity_requests": {
        "type": "array",
        "maxItems": 12,
        "items": {
          "$ref": "#/$defs/IdentityRequest"
        }
      },
      "assumptions": {
        "type": "array",
        "maxItems": 50,
        "items": {
          "$ref": "#/$defs/Assumption"
        }
      },
      "qc": {
        "$ref": "#/$defs/Qc"
      },
      "plan_sha256": {
        "description": "sha256 of the canonical plan without this field.",
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
      }
    },
    "$defs": {
      "Limits": {
        "description": "The effective numbers the plan was resolved with (rules-file defaults overridden by the effective rules); record invariants replay them.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "speaker_card_per_person",
          "speaker_card_display_seconds",
          "cta_max_count",
          "cta_min_gap_seconds",
          "cta_no_earlier_than_seconds",
          "section_title_max_seconds",
          "conflict_shift_seconds",
          "face_sample_fps_min"
        ],
        "properties": {
          "speaker_card_per_person": {
            "type": "integer",
            "minimum": 0,
            "maximum": 6
          },
          "speaker_card_display_seconds": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "min",
              "max"
            ],
            "properties": {
              "min": {
                "type": "number",
                "minimum": 2,
                "maximum": 6
              },
              "max": {
                "type": "number",
                "minimum": 2,
                "maximum": 8
              }
            }
          },
          "cta_max_count": {
            "type": "integer",
            "minimum": 0,
            "maximum": 6
          },
          "cta_min_gap_seconds": {
            "type": "number",
            "minimum": 0,
            "maximum": 3600
          },
          "cta_no_earlier_than_seconds": {
            "type": "number",
            "minimum": 0,
            "maximum": 300
          },
          "section_title_max_seconds": {
            "type": "number",
            "minimum": 0.5,
            "maximum": 2.5
          },
          "conflict_shift_seconds": {
            "type": "number",
            "minimum": 0,
            "maximum": 2
          },
          "face_sample_fps_min": {
            "type": "number",
            "minimum": 5,
            "maximum": 60
          }
        }
      },
      "Placement": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "overlay_id",
          "kind",
          "priority_rank",
          "start_frame",
          "end_frame",
          "region",
          "decided_by",
          "origin",
          "visual"
        ],
        "properties": {
          "overlay_id": {
            "type": "string",
            "pattern": "^ov_[a-z0-9_]{1,60}$"
          },
          "kind": {
            "$ref": "common.schema.json#/$defs/LayerKind"
          },
          "priority_rank": {
            "description": "1-based position of the kind in overlay-rules.json priority_order (caption_zone 1, face 2, speaker_card 3, section_title 4, cta 5, badge 6): a smaller rank wins a conflict.",
            "type": "integer",
            "minimum": 3,
            "maximum": 6
          },
          "start_frame": {
            "$ref": "common.schema.json#/$defs/Frame"
          },
          "end_frame": {
            "description": "Exclusive.",
            "$ref": "common.schema.json#/$defs/Frame"
          },
          "region": {
            "$ref": "common.schema.json#/$defs/RegionRef"
          },
          "decided_by": {
            "$ref": "common.schema.json#/$defs/Decider"
          },
          "origin": {
            "$ref": "common.schema.json#/$defs/RuleOrigin"
          },
          "visual": {
            "$ref": "common.schema.json#/$defs/VisualRef"
          },
          "anchor": {
            "description": "The transcript word the layer is bound to (CTA word). A deleted word makes the placement unresolved (existing word-anchor rule); it never moves silently.",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "word_id"
            ],
            "properties": {
              "word_id": {
                "$ref": "common.schema.json#/$defs/WordId"
              }
            }
          },
          "position": {
            "description": "Set when a CTA came from a fixed position (no spoken word).",
            "$ref": "common.schema.json#/$defs/CtaPosition"
          },
          "speaker": {
            "$ref": "common.schema.json#/$defs/SpeakerLabel"
          },
          "text": {
            "description": "Speaker card text: only what the user supplied or confirmed.",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "name",
              "title",
              "identity_source"
            ],
            "properties": {
              "name": {
                "type": "string",
                "minLength": 1,
                "maxLength": 80
              },
              "title": {
                "oneOf": [
                  {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 80
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "identity_source": {
                "$ref": "common.schema.json#/$defs/IdentitySource"
              }
            }
          },
          "label": {
            "description": "CTA card text or section title.",
            "$ref": "common.schema.json#/$defs/Label"
          },
          "shift": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "frames",
              "reason"
            ],
            "properties": {
              "frames": {
                "description": "Signed frames the window moved from its proposed start.",
                "type": "integer",
                "minimum": -100000000,
                "maximum": 100000000
              },
              "reason": {
                "$ref": "common.schema.json#/$defs/ShiftReason"
              }
            }
          },
          "region_changed_from": {
            "$ref": "common.schema.json#/$defs/RegionRef"
          },
          "unresolved": {
            "type": "boolean"
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "kind": {
                  "const": "speaker_card"
                }
              },
              "required": [
                "kind"
              ]
            },
            "then": {
              "required": [
                "speaker",
                "text"
              ]
            }
          },
          {
            "if": {
              "properties": {
                "kind": {
                  "const": "section_title"
                }
              },
              "required": [
                "kind"
              ]
            },
            "then": {
              "required": [
                "label"
              ]
            }
          },
          {
            "if": {
              "properties": {
                "unresolved": {
                  "const": true
                }
              },
              "required": [
                "unresolved"
              ]
            },
            "then": {
              "required": [
                "anchor"
              ]
            }
          }
        ]
      },
      "Dropped": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "reason"
        ],
        "properties": {
          "kind": {
            "$ref": "common.schema.json#/$defs/LayerKind"
          },
          "reason": {
            "$ref": "common.schema.json#/$defs/DropReason"
          },
          "speaker": {
            "$ref": "common.schema.json#/$defs/SpeakerLabel"
          },
          "word_id": {
            "$ref": "common.schema.json#/$defs/WordId"
          },
          "at_frame": {
            "$ref": "common.schema.json#/$defs/Frame"
          },
          "detail": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          }
        }
      },
      "IdentityRequest": {
        "description": "Ask mode: the agent asks who the speaker is and what the card says. A transcript self introduction only ever appears as a suggestion the user confirms.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "speaker",
          "needs"
        ],
        "properties": {
          "speaker": {
            "$ref": "common.schema.json#/$defs/SpeakerLabel"
          },
          "needs": {
            "type": "array",
            "minItems": 1,
            "maxItems": 2,
            "uniqueItems": true,
            "items": {
              "enum": [
                "name",
                "title"
              ]
            }
          },
          "suggested": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "name",
              "source",
              "word_ids"
            ],
            "properties": {
              "name": {
                "type": "string",
                "minLength": 1,
                "maxLength": 80
              },
              "source": {
                "const": "transcript_self_introduction"
              },
              "word_ids": {
                "type": "array",
                "minItems": 1,
                "maxItems": 8,
                "items": {
                  "$ref": "common.schema.json#/$defs/WordId"
                }
              }
            }
          },
          "thumbnail_seconds": {
            "description": "A moment where the speaker is on screen, for the small thumbnail of the question.",
            "$ref": "common.schema.json#/$defs/Seconds"
          }
        }
      },
      "Assumption": {
        "description": "A Varsayimlarim note (assistant-policy assumption_record reason_kind optional_item_omitted): an optional layer left out because a fact is missing. The assistant turns it into its own record.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "field_key",
          "reason_kind",
          "note_code",
          "speaker"
        ],
        "properties": {
          "field_key": {
            "type": "string",
            "pattern": "^speaker_card_s[1-9][0-9]?$"
          },
          "reason_kind": {
            "const": "optional_item_omitted"
          },
          "note_code": {
            "enum": [
              "speaker_card_identity_unknown",
              "speaker_card_title_missing",
              "speaker_card_no_valid_window"
            ]
          },
          "speaker": {
            "$ref": "common.schema.json#/$defs/SpeakerLabel"
          }
        }
      },
      "Qc": {
        "description": "The engine's own re-verification of the finished plan. A delivered plan has zero collisions and overlaps (record invariant).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "face_sample_fps_min",
          "checked_frames",
          "face_collisions",
          "caption_collisions",
          "overlaps",
          "unverifiable_windows"
        ],
        "properties": {
          "face_sample_fps_min": {
            "type": "number",
            "minimum": 5,
            "maximum": 60
          },
          "checked_frames": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100000000
          },
          "face_collisions": {
            "type": "integer",
            "minimum": 0
          },
          "caption_collisions": {
            "type": "integer",
            "minimum": 0
          },
          "overlaps": {
            "type": "integer",
            "minimum": 0
          },
          "unverifiable_windows": {
            "description": "Proposed windows skipped because the face samples were sparser than face_sample_fps_min.",
            "type": "integer",
            "minimum": 0
          }
        }
      }
    }
  },
  "overlay-rules.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/overlay-rules/v1/overlay-rules.schema.json",
    "title": "overlay_rules_v1",
    "description": "The overlay rule set of a template (brand_template_manifest_v2.overlay_rules, additive optional field) or of a channel preference (KARAR-ANLATIM-YERLESIM-KONUSMACI-VE-SABLONLAR SS8, Q49, Q106). Every layer is opt-in: a layer that is absent or enabled=false is never added; there are no defaults that switch a layer on (Q106). Values omitted from an enabled layer take the frozen defaults of overlay-rules.json (a start proposal, not a hard rule). The visual part is a Brand Element/Motion revision or the standard card; the rules never carry layer code. Per layer the effective rule is the user's request of this job, else the selected template's, else the channel preference.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version"
    ],
    "properties": {
      "schema_version": {
        "const": "overlay_rules_v1"
      },
      "speaker_card": {
        "$ref": "#/$defs/SpeakerCardRule"
      },
      "cta": {
        "$ref": "#/$defs/CtaRule"
      },
      "section_title": {
        "$ref": "#/$defs/SectionTitleRule"
      },
      "badge": {
        "$ref": "#/$defs/BadgeRule"
      }
    },
    "$defs": {
      "SpeakerCardRule": {
        "description": "Optional speaker introduction card. The agent asks for name and title; nothing is invented and in Auto a speaker whose name is unknown gets no card and a note in Varsayimlarim. Frequency per person by video length unless a fixed count is set; each display is short (reading time, 3-4 s by default) and closes; the window is validated frame by frame against the layout and the face tracks (TK-27).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "enabled"
        ],
        "properties": {
          "enabled": {
            "type": "boolean"
          },
          "require_title": {
            "description": "When true a card also needs the title (job), not only the name.",
            "type": "boolean"
          },
          "frequency": {
            "oneOf": [
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "mode"
                ],
                "properties": {
                  "mode": {
                    "const": "by_duration"
                  }
                }
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "mode",
                  "per_person"
                ],
                "properties": {
                  "mode": {
                    "const": "fixed"
                  },
                  "per_person": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 6
                  }
                }
              }
            ]
          },
          "display_seconds": {
            "description": "Bounds of one display; the actual length follows the reading time of the card text inside them. min <= max is a record invariant.",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "min",
              "max"
            ],
            "properties": {
              "min": {
                "type": "number",
                "minimum": 2,
                "maximum": 6
              },
              "max": {
                "type": "number",
                "minimum": 2,
                "maximum": 8
              }
            }
          },
          "visual": {
            "$ref": "common.schema.json#/$defs/VisualRef"
          }
        }
      },
      "CtaRule": {
        "description": "Subscribe / like card. It binds to the spoken CTA word (a negated sentence never triggers it), at most max_count times, at least min_gap_seconds apart and never before no_earlier_than_seconds. When no CTA word is spoken at all, the fixed positions apply. Defined only by the user's request or a template/channel preference (Q106); the default look is the standard card that slides up from the bottom.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "enabled"
        ],
        "properties": {
          "enabled": {
            "type": "boolean"
          },
          "phrase_binding": {
            "description": "Bind to spoken CTA words (default true). false: only the fixed positions.",
            "type": "boolean"
          },
          "phrases": {
            "description": "Extra spoken triggers on top of the platform dictionary (case and diacritics folded; a trailing * matches a word stem).",
            "type": "array",
            "maxItems": 12,
            "uniqueItems": true,
            "items": {
              "type": "string",
              "minLength": 2,
              "maxLength": 40
            }
          },
          "max_count": {
            "type": "integer",
            "minimum": 1,
            "maximum": 6
          },
          "min_gap_seconds": {
            "type": "number",
            "minimum": 30,
            "maximum": 3600
          },
          "no_earlier_than_seconds": {
            "type": "number",
            "minimum": 0,
            "maximum": 300
          },
          "positions": {
            "description": "Fixed positions used when no CTA word is spoken (default percent_25 then before_outro), or always when phrase_binding is false.",
            "type": "array",
            "maxItems": 3,
            "uniqueItems": true,
            "items": {
              "$ref": "common.schema.json#/$defs/CtaPosition"
            }
          },
          "display_seconds": {
            "type": "number",
            "minimum": 2,
            "maximum": 8
          },
          "label": {
            "description": "Card text; when absent the renderer's localized default is used.",
            "type": "string",
            "minLength": 1,
            "maxLength": 60
          },
          "visual": {
            "$ref": "common.schema.json#/$defs/VisualRef"
          }
        }
      },
      "SectionTitleRule": {
        "description": "Section title at each section boundary of the template instance, shown at most 2.5 s (the cap is part of the schema).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "enabled"
        ],
        "properties": {
          "enabled": {
            "type": "boolean"
          },
          "max_seconds": {
            "type": "number",
            "minimum": 0.5,
            "maximum": 2.5
          },
          "visual": {
            "$ref": "common.schema.json#/$defs/VisualRef"
          }
        }
      },
      "BadgeRule": {
        "description": "Persistent corner badge (a Brand Element). It has the lowest priority: it hides where a higher layer, a face or the captions need the corner.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "enabled"
        ],
        "properties": {
          "enabled": {
            "type": "boolean"
          },
          "visual": {
            "$ref": "common.schema.json#/$defs/VisualRef"
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "enabled": {
                  "const": true
                }
              },
              "required": [
                "enabled"
              ]
            },
            "then": {
              "required": [
                "visual"
              ]
            }
          }
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

export const DOCUMENT_TYPES = ["overlay-plan", "overlay-rules"] as const;
export type DocumentType = "overlay-plan" | "overlay-rules";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "overlay-plan": [
    "overlay_plan_v1"
  ],
  "overlay-rules": [
    "overlay_rules_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {};

export type OverlayPlan = {
    readonly "schema_version": "overlay_plan_v1";
    readonly "rules_revision": number;
    readonly "fps": number;
    readonly "duration_frames": number;
    readonly "layout_timeline_sha256"?: unknown;
    readonly "rules_sha256": unknown;
    readonly "limits": unknown;
    readonly "placements": readonly (unknown)[];
    readonly "dropped": readonly (unknown)[];
    readonly "identity_requests": readonly (unknown)[];
    readonly "assumptions": readonly (unknown)[];
    readonly "qc": unknown;
    readonly "plan_sha256": unknown;
  };
export type OverlayRules = {
    readonly "schema_version": "overlay_rules_v1";
    readonly "speaker_card"?: unknown;
    readonly "cta"?: unknown;
    readonly "section_title"?: unknown;
    readonly "badge"?: unknown;
  };

export const reader = new ContractPackageReader({
  package: "overlay-rules",
  schemas: { ...SCHEMAS, ...DEPENDENCY_SCHEMAS } as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
