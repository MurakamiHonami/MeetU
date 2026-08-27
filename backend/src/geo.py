"""位置情報の扱い。geohash による近傍検索と距離計算。

DynamoDB には地理検索が無いので、緯度経度を geohash に落として
「同じセル + 隣接セル」を Query し、最後に実距離で絞り込む。
外部ライブラリは使わない。
"""

import math

from common import ApiError

BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"

# geohash の桁数ごとのおおよそのセルサイズ（緯度・経度の度数）
CELL_SIZE = {
    4: (0.176, 0.352),    # 約 20km
    5: (0.044, 0.044),    # 約 5km
    6: (0.0055, 0.011),   # 約 1km
}

# 検索半径からどの桁数を使うか
DEFAULT_PRECISION = 5
MAX_RADIUS_KM = 50.0
EARTH_RADIUS_KM = 6371.0


def validate(lat, lon):
    """緯度経度として妥当か確かめて float で返す。"""
    try:
        lat = float(lat)
        lon = float(lon)
    except (TypeError, ValueError):
        raise ApiError(400, "緯度経度が数値ではありません", "invalid_location")
    if not -90.0 <= lat <= 90.0 or not -180.0 <= lon <= 180.0:
        raise ApiError(400, "緯度経度の範囲が不正です", "invalid_location")
    return lat, lon


def encode(lat, lon, precision=DEFAULT_PRECISION):
    """緯度経度を geohash 文字列にする。"""
    lat_range = [-90.0, 90.0]
    lon_range = [-180.0, 180.0]
    bits = (16, 8, 4, 2, 1)

    out = []
    bit = 0
    ch = 0
    use_lon = True

    while len(out) < precision:
        if use_lon:
            mid = (lon_range[0] + lon_range[1]) / 2
            if lon > mid:
                ch |= bits[bit]
                lon_range[0] = mid
            else:
                lon_range[1] = mid
        else:
            mid = (lat_range[0] + lat_range[1]) / 2
            if lat > mid:
                ch |= bits[bit]
                lat_range[0] = mid
            else:
                lat_range[1] = mid

        use_lon = not use_lon
        if bit < 4:
            bit += 1
        else:
            out.append(BASE32[ch])
            bit = 0
            ch = 0

    return "".join(out)


def precision_for(radius_km):
    """検索半径に見合う桁数。広いほど粗いセルを使う。"""
    if radius_km <= 1.5:
        return 6
    if radius_km <= 8:
        return 5
    return 4


def cells_around(lat, lon, precision=DEFAULT_PRECISION):
    """中心セルと周囲 8 セルの geohash。セル境界に近い相手を取りこぼさないため。"""
    lat_step, lon_step = CELL_SIZE.get(precision, CELL_SIZE[DEFAULT_PRECISION])
    found = set()
    for d_lat in (-lat_step, 0.0, lat_step):
        for d_lon in (-lon_step, 0.0, lon_step):
            near_lat = max(-90.0, min(90.0, lat + d_lat))
            near_lon = lon + d_lon
            # 日付変更線をまたいだら折り返す
            if near_lon > 180.0:
                near_lon -= 360.0
            elif near_lon < -180.0:
                near_lon += 360.0
            found.add(encode(near_lat, near_lon, precision))
    return sorted(found)


def distance_km(lat1, lon1, lat2, lon2):
    """2 点間の距離（ハバサイン公式）。"""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def format_distance(km):
    """表示用。1km 未満は m にする。"""
    if km < 1:
        return f"{int(round(km * 1000 / 50)) * 50}m"
    if km < 10:
        return f"{km:.1f}km"
    return f"{int(round(km))}km"


def parse_location(raw):
    """カードやメッセージに付ける位置情報を整える。未指定なら None。"""
    if not raw:
        return None
    if not isinstance(raw, dict):
        raise ApiError(400, "location はオブジェクトで指定してください", "invalid_location")

    lat, lon = validate(raw.get("lat"), raw.get("lon"))
    location = {
        "lat": str(lat),        # DynamoDB は float を扱えないので文字列で持つ
        "lon": str(lon),
        "geohash": encode(lat, lon, 6),
    }
    name = (raw.get("name") or "").strip()[:60]
    if name:
        location["name"] = name
    return location


def location_view(location):
    """API で返す形。数値に戻す。"""
    if not location:
        return None
    view = {"lat": float(location["lat"]), "lon": float(location["lon"])}
    if location.get("name"):
        view["name"] = location["name"]
    return view
