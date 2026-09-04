import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "../../shared/lib/navigation";
import MyLocationRoundedIcon from "@mui/icons-material/MyLocationRounded";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { nearbyApi } from "../../features/nearby/api";
import { TYPE_LABEL, type Card, type CardType } from "../../entities/card/model";
import type { GeoPoint } from "../../entities/user/geo";
import { currentPosition } from "../../shared/lib/device";

const RADIUS_CHOICES = [1, 3, 10];
const TYPE_COLOR: Record<CardType, string> = {
  GIVE: "#00c2a8",
  WANT: "#e43d81",
  COMPANION: "#cb9605",
};

/** カード種別ごとに色を変えたピン。Leaflet 既定の画像は使わない（読み込みが要るため） */
function pinIcon(type: CardType) {
  return L.divIcon({
    className: "",
    html: `<span class="map-pin" style="background:${TYPE_COLOR[type]}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

const meIcon = L.divIcon({
  className: "",
  html: '<span class="map-me"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export function NearbyMapView() {
  const navigate = useNavigate();
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  const [center, setCenter] = useState<GeoPoint | null>(null);
  const [radius, setRadius] = useState(3);
  const [type, setType] = useState<CardType | "">("");
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 地図の生成は 1 回だけ
  useEffect(() => {
    if (!holder.current || map.current) return;

    const instance = L.map(holder.current, { zoomControl: false }).setView(
      [35.681236, 139.767125], // 現在地が取れるまでの仮の中心（東京駅）
      14,
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(instance);
    L.control.zoom({ position: "bottomright" }).addTo(instance);

    map.current = instance;
    layer.current = L.layerGroup().addTo(instance);

    return () => {
      instance.remove();
      map.current = null;
    };
  }, []);

  const search = useCallback(async (point: GeoPoint, km: number, kind: CardType | "") => {
    setLoading(true);
    setError("");
    try {
      const res = await nearbyApi.nearby({
        lat: point.lat,
        lon: point.lon,
        radius: km,
        type: kind,
      });
      setCards(res.cards);
    } catch (e) {
      setError((e as Error).message);
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 起動時に現在地へ寄せる
  useEffect(() => {
    let alive = true;
    currentPosition()
      .then((point) => {
        if (!alive) return;
        setCenter(point);
        map.current?.setView([point.lat, point.lon], 15);
        void search(point, radius, type);
      })
      .catch((e) => setError((e as Error).message));
    return () => {
      alive = false;
    };
    // 初回のみ。以降は操作に応じて再検索する
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 検索結果をピンとして描き直す
  useEffect(() => {
    const group = layer.current;
    if (!group || !map.current) return;
    group.clearLayers();

    if (center) {
      L.marker([center.lat, center.lon], { icon: meIcon }).addTo(group);
      L.circle([center.lat, center.lon], {
        radius: radius * 1000,
        color: "#e43d81",
        weight: 2,
        fillOpacity: 0.05,
      }).addTo(group);
    }

    cards.forEach((card) => {
      if (!card.location) return;
      const marker = L.marker([card.location.lat, card.location.lon], {
        icon: pinIcon(card.type),
      }).addTo(group);
      marker.bindPopup(
        `<strong>${TYPE_LABEL[card.type]}${card.title}</strong><br>${card.distanceLabel ?? ""}`,
      );
      marker.on("click", () => marker.openPopup());
    });
  }, [cards, center, radius]);

  function recenter() {
    currentPosition()
      .then((point) => {
        setCenter(point);
        map.current?.setView([point.lat, point.lon], 15);
        void search(point, radius, type);
      })
      .catch((e) => setError((e as Error).message));
  }

  function changeRadius(km: number) {
    setRadius(km);
    if (center) void search(center, km, type);
  }

  function changeType(kind: CardType | "") {
    setType(kind);
    if (center) void search(center, radius, kind);
  }

  return (
    <div className="page">
      <h2>近くのカード</h2>

      <div className="map-holder">
        <div ref={holder} className="map" />
        <button className="map-locate" onClick={recenter} title="現在地に戻る">
          <MyLocationRoundedIcon />
        </button>
      </div>

      <div className="map-controls">
        <div className="typeswitch">
          {RADIUS_CHOICES.map((km) => (
            <button
              key={km}
              className={radius === km ? "active" : ""}
              onClick={() => changeRadius(km)}
            >
              {km}km
            </button>
          ))}
        </div>
        <div className="typeswitch">
          <button className={type === "" ? "active" : ""} onClick={() => changeType("")}>
            すべて
          </button>
          {(Object.keys(TYPE_LABEL) as CardType[]).map((t) => (
            <button key={t} className={type === t ? "active" : ""} onClick={() => changeType(t)}>
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="loading">探しています…</p>}

      {!loading && (
        <>
          <h3>{cards.length}件</h3>
          {cards.length === 0 && !error && (
            <p className="hint">
              この範囲に位置情報つきのカードはありません。範囲を広げてみてください。
            </p>
          )}
          {cards.map((card) => (
            <article
              key={card.cardId}
              className="card card-clickable"
              onClick={() => navigate(`/cards/${card.cardId}`)}
            >
              <div className="card-head">
                <span className={`badge badge-${card.type}`}>{TYPE_LABEL[card.type]}</span>
                <h3>{card.title}</h3>
                <span className="distance">{card.distanceLabel}</span>
              </div>
              <div className="chips chips-sm">
                {card.tags.map((tag) => (
                  <span key={tag.tagId} className="chip">
                    {tag.name}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </>
      )}
    </div>
  );
}
