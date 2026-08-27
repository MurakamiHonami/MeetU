"""地図で近くのカードを探す。

geohash のセルを引いてから実距離で絞る。イベント会場でその場で交換相手を
見つける用途を想定しているので、既定の半径は狭めにしてある。
"""

import db
import geo
from common import ApiError, response
from handlers.cards import CARD_TYPES, card_view

DEFAULT_RADIUS_KM = 3.0
MAX_RESULTS = 60


def _radius(raw):
    if raw in (None, ""):
        return DEFAULT_RADIUS_KM
    try:
        km = float(raw)
    except (TypeError, ValueError):
        raise ApiError(400, "radius は数値で指定してください", "invalid_radius")
    if km <= 0:
        raise ApiError(400, "radius は 0 より大きい値にしてください", "invalid_radius")
    return min(km, geo.MAX_RADIUS_KM)


def search(ctx):
    """?lat=35.68&lon=139.76&radius=3&type=GIVE"""
    user_id = ctx["user"]["userId"]
    query = ctx["query"]

    lat, lon = geo.validate(query.get("lat"), query.get("lon"))
    radius = _radius(query.get("radius"))

    card_type = query.get("type")
    if card_type and card_type not in CARD_TYPES:
        raise ApiError(400, f"type は {'/'.join(CARD_TYPES)} のいずれかです", "invalid_type")

    precision = geo.precision_for(radius)
    cells = geo.cells_around(lat, lon, precision)

    seen, owners, results = set(), {}, []
    for hit in db.cards_in_cells(cells):
        card_id = hit.get("cardId") or hit.get("GSI3SK")
        if not card_id or card_id in seen:
            continue
        seen.add(card_id)

        if hit.get("status") != "OPEN" or hit.get("ownerId") == user_id:
            continue
        if card_type and hit.get("type") != card_type:
            continue

        location = hit.get("location")
        if not location:
            continue

        # セルは四角いので、最後は実距離で丸く切る
        distance = geo.distance_km(lat, lon, float(location["lat"]), float(location["lon"]))
        if distance > radius:
            continue

        owner_id = hit["ownerId"]
        if owner_id not in owners:
            owners[owner_id] = db.get_user(owner_id)
        if db.is_blocked(owners[owner_id]):
            continue

        view = card_view(hit, db.public_user(owners[owner_id]))
        view["distanceKm"] = round(distance, 2)
        view["distanceLabel"] = geo.format_distance(distance)
        results.append(view)

    results.sort(key=lambda c: c["distanceKm"])
    return response(200, {
        "cards": results[:MAX_RESULTS],
        "center": {"lat": lat, "lon": lon},
        "radiusKm": radius,
    })
