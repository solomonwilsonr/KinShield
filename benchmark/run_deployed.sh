#!/usr/bin/env bash
# Run all scenarios through the DEPLOYED public API and check risk levels + benign integrity.
set -uo pipefail
API="${1:-https://zx9d4nrkni.execute-api.us-east-1.amazonaws.com}"
PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
pass=0; fail=0
for f in "$PROJECT"/benchmark/scenarios/*.json; do
  id=$(python3 -c "import json,sys;print(json.load(open('$f'))['id'])")
  label=$(python3 -c "import json,sys;print(json.load(open('$f')).get('label',''))")
  exp=$(python3 -c "import json,sys;print(json.load(open('$f')).get('expected',{}).get('risk_level',''))")
  resp=$(curl -sS "$API/detect" -H "Content-Type: application/json" -d "{\"scenario_id\":\"$id\"}")
  got=$(echo "$resp" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('risk_level','ERR'))")
  score=$(echo "$resp" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('risk_score','-'))")
  ev=$(echo "$resp" | python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d.get('evidence',[])))")
  lat=$(echo "$resp" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('latency_ms','?'))")
  if [ "$got" = "ERR" ]; then echo "  raw: $resp"; fi
  if [ "$label" = "benign" ]; then
    ok=$([ "$got" = "LOW" ] && [ "$ev" -eq 0 ] && echo 1 || echo 0)
  else
    ok=$([ "$got" = "HIGH" ] || [ "$got" = "MEDIUM" ] && echo 1 || echo 0)
  fi
  [ "$ok" = "1" ] && { pass=$((pass+1)); tag=OK; } || { fail=$((fail+1)); tag=FAIL; }
  printf "%-12s label=%-6s exp=%-6s got=%-6s score=%-3s ev=%-2s lat=%sms %s\n" \
    "$id" "$label" "$exp" "$got" "$score" "$ev" "$lat" "$tag"
  sleep 1
done
echo ""
echo "$pass passed, $fail failed"
