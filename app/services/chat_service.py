import logging

from app.services.sitrep_service import SitrepContext, get_risk_level, get_sitrep_context

logger = logging.getLogger(__name__)


def _event_trend_text(context: SitrepContext) -> str:
    if context.event_count >= 20 or context.fatalities >= 100:
        return "Recent indicators show sustained high-tempo activity."
    if context.event_count >= 8 or context.fatalities >= 25:
        return "Recent indicators show moderate but persistent activity."
    return "Recent indicators remain limited, with no clear surge in activity."


def _question_intent(question: str) -> str:
    lowered = question.lower()
    if any(word in lowered for word in ["why", "flag", "driver", "cause"]):
        return "driver"
    if any(word in lowered for word in ["serious", "risk", "how bad", "critical", "severity"]):
        return "severity"
    if any(word in lowered for word in ["recent", "happened", "latest", "trend"]):
        return "recent"
    if any(word in lowered for word in ["recommend", "action", "next step", "do"]):
        return "action"
    return "general"


def answer_question(question: str, hex_id: str | None = None) -> tuple[str, bool]:
    if not hex_id:
        logger.debug("Chat request without hex context")
        return (
            "Please provide a hex_id for a region-specific assessment. "
            "Without location context, I can only provide general monitoring guidance.",
            False,
        )

    context = get_sitrep_context(hex_id)
    if context is None:
        logger.info("Chat requested for missing hex_id=%s", hex_id)
        return f"No data was found for hex {hex_id}. Verify the identifier and try again.", False

    risk_level = get_risk_level(context.threat_score)
    anomaly_text = "An anomaly is currently flagged." if context.anomaly else "No major anomaly is currently flagged."
    trend_text = _event_trend_text(context)
    intent = _question_intent(question)

    if intent == "driver":
        answer = (
            f"This region is {risk_level} risk, primarily driven by {context.event_count} events, "
            f"{context.fatalities} fatalities, and a threat score of {context.threat_score:.2f}. "
            f"{anomaly_text}"
        )
    elif intent == "severity":
        answer = (
            f"Severity assessment: {risk_level.upper()} risk. Threat score is {context.threat_score:.2f}. "
            f"{trend_text}"
        )
    elif intent == "recent":
        event_preview = ", ".join(context.recent_event_types[:4]) if context.recent_event_types else "no specific event types available"
        answer = f"Recent events in this hex include {event_preview}. {trend_text}"
    elif intent == "action":
        if risk_level in {"high", "critical"}:
            answer = "Increase monitoring frequency, notify stakeholders, and validate any new anomaly indicators within the next reporting cycle."
        elif risk_level == "medium":
            answer = "Maintain active monitoring and re-evaluate this sector after additional event updates."
        else:
            answer = "Continue baseline monitoring; no immediate escalation is indicated."
    else:
        answer = (
            f"Hex {context.hex_id} is currently assessed as {risk_level.upper()} risk with "
            f"{context.event_count} events and {context.fatalities} fatalities. "
            f"Threat score is {context.threat_score:.2f}. {anomaly_text}"
        )

    return answer, True
