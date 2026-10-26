import {afterEach,expect,it,vi} from "vitest";
import {rejectCrossOriginMutation} from "./same-origin";
afterEach(()=>vi.unstubAllEnvs());
for(const origin of [undefined,"null","https://foreign.example.test","http://127.0.0.1:3100/","http://127.0.0.1:3100.evil.test","broken"]) {
  it(`denies invalid mutation origin ${origin}`,()=>{
    vi.stubEnv("APP_BASE_URL","http://127.0.0.1:3100");
    expect(rejectCrossOriginMutation(new Request("http://internal:3000/api",{method:"POST",headers:{...(origin?{origin}:{}),"x-forwarded-host":"127.0.0.1:3100"}}))?.status).toBe(403);
  });
}
it("allows canonical origin behind an internal proxy URL",()=>{
  vi.stubEnv("APP_BASE_URL","https://app.example.test");
  expect(rejectCrossOriginMutation(new Request("http://internal:3000/api",{headers:{origin:"https://app.example.test"}}))).toBeNull();
});
