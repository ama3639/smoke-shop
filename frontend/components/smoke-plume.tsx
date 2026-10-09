/** Local smoke texture; CSS moves the two layers with scene scroll progress. */
export default function SmokePlume() {
  return (
    <div className="scene-smoke" aria-hidden="true">
      {["far", "near"].map((depth) => (
        <div className={`smoke-cloud smoke-cloud-${depth}`} key={depth}>
          <img
            src="/images/smoke-plume.webp"
            alt=""
            width="1024"
            height="1536"
            decoding="async"
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}
