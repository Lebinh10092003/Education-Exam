import os
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

def check_vps_overloaded() -> bool:
    """
    Returns True if VPS resources are overloaded (less than 50% CPU or memory is free),
    meaning CPU usage > 50% or RAM usage > 50%.
    Supports test/debug overrides:
    - PROCTORING_SKIP_RESOURCE_CHECK: returns False (never overloaded)
    - PROCTORING_FORCE_RESOURCE_OVERLOAD: returns True (always overloaded)
    """
    if getattr(settings, "PROCTORING_SKIP_RESOURCE_CHECK", False):
        return False

    if getattr(settings, "PROCTORING_FORCE_RESOURCE_OVERLOAD", False):
        logger.info("System resource check: FORCED OVERLOAD by setting.")
        return True

    try:
        import psutil
        cpu_usage = psutil.cpu_percent(interval=0.1)
        ram_usage = psutil.virtual_memory().percent
        overloaded = cpu_usage > 50 or ram_usage > 50
        logger.info(
            f"System resource check (psutil): CPU={cpu_usage}%, RAM={ram_usage}%, overloaded={overloaded}"
        )
        return overloaded
    except ImportError:
        # Fallback for Linux environments if psutil is not available
        try:
            cpu_usage = 0.0
            if os.path.exists("/proc/loadavg"):
                with open("/proc/loadavg", "r") as f:
                    load_1m = float(f.read().split()[0])
                cpu_count = os.cpu_count() or 1
                cpu_usage = (load_1m / cpu_count) * 100

            ram_usage = 0.0
            if os.path.exists("/proc/meminfo"):
                meminfo = {}
                with open("/proc/meminfo", "r") as f:
                    for line in f:
                        parts = line.split()
                        if len(parts) >= 2:
                            meminfo[parts[0].rstrip(":")] = int(parts[1])
                mem_total = meminfo.get("MemTotal", 1)
                mem_free = (
                    meminfo.get("MemFree", 0)
                    + meminfo.get("Buffers", 0)
                    + meminfo.get("Cached", 0)
                )
                ram_usage = ((mem_total - mem_free) / mem_total) * 100

            overloaded = cpu_usage > 50 or ram_usage > 50
            logger.info(
                f"System resource check (proc fallback): CPU={cpu_usage:.1f}%, RAM={ram_usage:.1f}%, overloaded={overloaded}"
            )
            return overloaded
        except Exception as e:
            logger.warning(f"Error reading system resources fallback: {e}")
            return False
