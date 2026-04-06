"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Job {
  id: string; title: string; company: string; location: string;
  work_mode: string; salary: string; posted: string; dist_miles: number | null;
  lat: number | null; lng: number | null;
}

const DOT: Record<string, string> = { onsite: "#D42B2B", hybrid: "#C48A2B", remote: "#2B8C5A" };

function makeIcon(color: string, big: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="width:${big ? 16 : 10}px;height:${big ? 16 : 10}px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
    iconSize: [big ? 16 : 10, big ? 16 : 10],
    iconAnchor: [big ? 8 : 5, big ? 8 : 5],
  });
}

const userIcon = L.divIcon({
  className: "",
  html: '<div style="width:14px;height:14px;background:#D42B2B;border:3px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(212,43,43,0.5)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function FitBounds({ jobs }: { jobs: Job[] }) {
  const map = useMap();
  useEffect(() => {
    const mj = jobs.filter((j) => j.lat && j.lng);
    if (mj.length > 0) {
      const bounds = L.latLngBounds(mj.map((j) => [j.lat!, j.lng!] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [jobs, map]);
  return null;
}
export default function MapView({
  jobs, hovId, onHov, onSel, radius, origin,
}: {
  jobs: Job[]; hovId: string | null;
  onHov: (id: string | null) => void;
  onSel: (j: Job) => void; radius: number; origin?: [number, number];
}) {
  const mj = jobs.filter((j) => j.lat && j.lng);
  const cLat = origin ? origin[0] : mj.length ? mj.reduce((s, j) => s + (j.lat || 0), 0) / mj.length : 39.8;
  const cLng = origin ? origin[1] : mj.length ? mj.reduce((s, j) => s + (j.lng || 0), 0) / mj.length : -98.6;
  const zoom = radius <= 5 ? 11 : radius <= 10 ? 10 : radius <= 25 ? 8 : radius <= 50 ? 6 : 5;

  return (
    <MapContainer
      center={[cLat, cLng]}
      zoom={zoom}
      style={{ width: "100%", height: 340, borderRadius: 14, border: "1px solid #E0DBD6" }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://openstreetmap.org">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Circle
        center={[cLat, cLng]}
        radius={radius * 1609.34}
        pathOptions={{ color: "#D42B2B", weight: 1.5, dashArray: "6 4", fillColor: "#D42B2B", fillOpacity: 0.04 }}
      />
      <Marker position={[cLat, cLng]} icon={userIcon} />
      {mj.map((j) => (
        <Marker
          key={j.id}
          position={[j.lat!, j.lng!]}
          icon={makeIcon(DOT[j.work_mode], hovId === j.id)}
          eventHandlers={{
            mouseover: () => onHov(j.id),
            mouseout: () => onHov(null),
            click: () => onSel(j),
          }}
        >
          <Popup>
            <div style={{ fontFamily: "sans-serif" }}>
              <b style={{ fontSize: 13 }}>{j.title}</b><br />
              <span style={{ fontSize: 11, color: "#777" }}>{j.company}</span><br />
              <span style={{ fontSize: 11, fontWeight: 600 }}>{j.salary}</span>
              {j.dist_miles && <span style={{ fontSize: 11, color: "#D42B2B", marginLeft: 6 }}>{j.dist_miles} mi</span>}
            </div>
          </Popup>
        </Marker>
      ))}
      <FitBounds jobs={jobs} />
    </MapContainer>
  );
}
