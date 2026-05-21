from django.conf import settings


class BudgetExceeded(Exception):
    pass


def guard_cost(estimated_usd: float):
    cap = settings.LLM_MAX_USD_PER_GEN
    if estimated_usd > cap:
        raise BudgetExceeded(
            f"Estimated cost ${estimated_usd:.4f} exceeds per-generation cap ${cap:.2f}"
        )
