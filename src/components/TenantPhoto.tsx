import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, SwitchCamera, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { Tenant } from "../domain/models";
import { fileStorage } from "../services/fileStorage";
import { firebaseMode } from "../data/firebase";
import { prepareProfilePhoto } from "../services/profilePhoto";
import { Button, Modal } from "./ui";
import "./TenantPhoto.css";

function usePhotoUrl(blob: Blob | null) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!blob) return;
    const next = URL.createObjectURL(blob);
    const timer = window.setTimeout(() => setUrl(next), 0);
    return () => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(next);
    };
  }, [blob]);
  return blob ? url : "";
}

export function TenantAvatar({
  tenant,
  className = "",
}: {
  tenant: Tenant;
  className?: string;
}) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const photoKey = firebaseMode ? undefined : tenant.photo?.key;
  const photoVersion = tenant.photo?.updatedAt;
  useEffect(() => {
    let current = true;
    if (photoKey)
      void fileStorage
        .getTenantPhoto(tenant.id)
        .then((photo) => {
          if (current) setBlob(photo);
        })
        .catch(() => {
          if (current) setBlob(null);
        });
    return () => {
      current = false;
    };
  }, [tenant.id, photoKey, photoVersion]);
  const url = usePhotoUrl(photoKey ? blob : null);
  return (
    <span className={`avatar tenant-avatar ${className}`} aria-hidden="true">
      {url ? <img src={url} alt="" /> : tenant.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function CameraCapture({
  onUse,
  onClose,
}: {
  onUse: (blob: Blob) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [restart, setRestart] = useState(0);
  const [captured, setCaptured] = useState<Blob | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const preview = usePhotoUrl(captured);
  const stop = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  };
  useEffect(() => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
      return;
    let active = true;
    void navigator.mediaDevices
      .getUserMedia({ audio: false, video: { facingMode: { ideal: facing } } })
      .then(async (next) => {
        if (!active) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = next;
        if (video.current) {
          video.current.srcObject = next;
          try {
            await video.current.play();
          } catch {
            next.getTracks().forEach((track) => track.stop());
            throw new Error("Camera preview unavailable");
          }
          if (active) setReady(true);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Camera access was blocked or unavailable. You can upload a photo instead.",
          );
      });
    return () => {
      active = false;
      stop();
    };
  }, [facing, restart]);
  const capture = async () => {
    const source = video.current;
    if (!source?.videoWidth || !source.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = source.videoWidth;
    canvas.height = source.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      stop();
      setError("Photo capture is unavailable in this browser.");
      return;
    }
    context.drawImage(source, 0, 0);
    stop();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (blob) setCaptured(blob);
    else setError("Could not capture the photo. Please try again.");
  };
  const use = async () => {
    if (!captured) return;
    try {
      onUse(await prepareProfilePhoto(captured));
      onClose();
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  return (
    <Modal
      title="Capture photo"
      description="Take a clear photo of the resident."
      onClose={() => {
        stop();
        onClose();
      }}
    >
      <div className="dialog-body camera-dialog">
        {!window.isSecureContext || !navigator.mediaDevices?.getUserMedia ? (
          <p role="alert">
            Camera capture needs HTTPS or localhost. Open the app on one of
            those addresses, or use Upload Photo.
          </p>
        ) : (
          <>
            <div className="camera-stage">
              {captured && preview ? (
                <img src={preview} alt="Captured photo preview" />
              ) : (
                <video
                  ref={video}
                  className={facing === "user" ? "mirror" : ""}
                  autoPlay
                  playsInline
                  muted
                  aria-label="Live camera preview"
                />
              )}
            </div>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="camera-actions">
              {!captured ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setReady(false);
                      setError("");
                      setFacing(facing === "user" ? "environment" : "user");
                    }}
                  >
                    <SwitchCamera size={16} /> Switch camera
                  </Button>
                  <Button
                    type="button"
                    disabled={!ready}
                    onClick={() => void capture()}
                  >
                    <Camera size={16} /> Capture
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setReady(false);
                      setCaptured(null);
                      setError("");
                      setRestart((value) => value + 1);
                    }}
                  >
                    <RefreshCw size={16} /> Retake
                  </Button>
                  <Button type="button" onClick={() => void use()}>
                    Use Photo
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  stop();
                  onClose();
                }}
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export function TenantPhotoPicker({
  tenant,
  photo,
  removed,
  onChange,
  onRemove,
}: {
  tenant?: Tenant;
  photo: Blob | null;
  removed: boolean;
  onChange: (photo: Blob) => void;
  onRemove: () => void;
}) {
  const upload = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState(false);
  const url = usePhotoUrl(photo);
  const showExisting = !!tenant?.photo && !photo && !removed;
  return (
    <section className="tenant-photo-picker" aria-label="Resident photo">
      <div className="tenant-photo-preview">
        {url ? (
          <img src={url} alt="New resident photo preview" />
        ) : showExisting && tenant ? (
          <TenantAvatar tenant={tenant} />
        ) : (
          <span className="tenant-photo-empty">
            <Camera size={28} />
            <small>No photo</small>
          </span>
        )}
      </div>
      <div className="tenant-photo-controls">
        <h3>Profile photo</h3>
        <p>Use a clear face photo. JPEG, PNG or WebP, up to 10 MB.</p>
        <div className="button-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => setCamera(true)}
          >
            <Camera size={16} /> Capture Photo
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => upload.current?.click()}
          >
            <Upload size={16} /> Upload Photo
          </Button>
          {(photo || showExisting) && (
            <Button type="button" variant="ghost" onClick={onRemove}>
              <Trash2 size={16} /> Remove
            </Button>
          )}
        </div>
        <input
          ref={upload}
          hidden
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Choose profile photo"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            try {
              onChange(await prepareProfilePhoto(file));
            } catch (cause) {
              toast.error((cause as Error).message);
            }
          }}
        />
      </div>
      {camera && (
        <CameraCapture onUse={onChange} onClose={() => setCamera(false)} />
      )}
    </section>
  );
}
