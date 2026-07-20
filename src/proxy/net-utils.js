export function stripProtocol(arg0) {
  return arg0.replace(/^https?:\/\//, "");
}
export function parseHost(arg0) {
  const tmp0 = String(arg0 || "");
  const slashIdx = tmp0.indexOf("/");
  const hostPort = slashIdx >= 0 ? tmp0.slice(0, slashIdx) : tmp0;
  const tmp1 = hostPort.split(":");
  if (tmp1.length >= 2 && /^\d+$/.test(tmp1[tmp1.length - 1])) {
    return {
      hostname: tmp1.slice(0, -1).join(":"),
      port: parseInt(tmp1[tmp1.length - 1], 10)
    };
  }
  const tmp2 = {
    hostname: hostPort,
    port: 443
  };
  return tmp2;
}
export function isLocalTarget(arg0) {
  const tmp1 = stripProtocol(arg0).toLowerCase();
  const slashIdx = tmp1.indexOf("/");
  const hostPort = slashIdx >= 0 ? tmp1.slice(0, slashIdx) : tmp1;
  const tmp2 = hostPort.replace(/:\d+$/, "");
  if (tmp2 === "127.0.0.1" || tmp2 === "localhost" || tmp2 === "0.0.0.0" || tmp2 === "::1" || tmp2 === "[::1]") {
    return true;
  }
  const tmp3 = parseHost(tmp1);
  return tmp3.port !== 443 && tmp3.port !== 80 && /:\d+$/.test(hostPort);
}
export function getLoopbackListenHosts(arg0) {
  const tmp1 = String(arg0 ?? process.env.BIND_HOST ?? "127.0.0.1").trim();
  if (tmp1 && tmp1 !== "127.0.0.1") {
    return [tmp1];
  }
  return ["127.0.0.1", "::1"];
}
export function listenHttpOnLoopback(fn, arg1, arg2, fn2, arg4) {
  const tmp5 = getLoopbackListenHosts(arg2);
  if (tmp5.length === 1) {
    const tmp0 = fn(true);
    tmp0.listen(arg1, tmp5[0], fn2);
    if (arg4) {
      tmp0.on("error", arg4);
    }
    return tmp0;
  }
  let tmp6 = tmp5.length;
  let tmp7 = null;
  const tmp8 = () => {
    tmp6 -= 1;
    if (tmp6 === 0 && fn2) {
      fn2();
    }
  };
  for (let tmp0 = 0; tmp0 < tmp5.length; tmp0++) {
    const tmp02 = fn(tmp0 === 0);
    if (tmp0 === 0) {
      tmp7 = tmp02;
    }
    if (arg4) {
      tmp02.on("error", arg4);
    }
    tmp02.listen(arg1, tmp5[tmp0], tmp8);
  }
  return tmp7;
}
export function loopbackApiUrl(arg0) {
  return "http://127.0.0.1:" + arg0;
}
