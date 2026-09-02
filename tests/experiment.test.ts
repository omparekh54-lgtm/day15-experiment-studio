import test from "node:test";
import assert from "node:assert/strict";
import { analyze, detectableRelativeLift, exportDecisionMemo, parseCsv, sampleSizePerVariant, segmentResults } from "../lib/experiment";

test("quoted csv parses",()=>{ const r=parseCsv('user_id,variant,converted,segment\n1,"Control",0,mobile\n2,"Treatment",1,mobile'); assert.equal(r.length,2); assert.equal(r[1].converted,1); });
test("positive treatment lift is detected",()=>{ const rows=[] as any[]; for(let i=0;i<1000;i++){rows.push({variant:"Control",converted:i<100?1:0});rows.push({variant:"Treatment",converted:i<140?1:0});} const r=analyze(rows); assert.ok(r.absoluteLift>0.03); assert.ok(r.pValue<0.05); });
test("sample size rises as MDE shrinks",()=>{ assert.ok(sampleSizePerVariant(.1,.05)>sampleSizePerVariant(.1,.2)); });
test("detectable lift is bounded",()=>{ const x=detectableRelativeLift(.1,5000); assert.ok(x>0 && x<1); });
test("SRM catches extreme imbalance",()=>{ const rows=[] as any[]; for(let i=0;i<1800;i++) rows.push({variant:"Control",converted:0}); for(let i=0;i<200;i++) rows.push({variant:"Treatment",converted:0}); assert.equal(analyze(rows).srmFlag,true); });
test("segments produce exploratory results",()=>{ const rows=[] as any[]; for(let i=0;i<200;i++){rows.push({variant:"Control",converted:i<20?1:0,segment:"mobile"});rows.push({variant:"Treatment",converted:i<30?1:0,segment:"mobile"});} assert.equal(segmentResults(rows).length,1); });
test("decision memo includes honesty note",()=>{ const rows=[] as any[]; for(let i=0;i<1000;i++){rows.push({variant:"Control",converted:i<100?1:0});rows.push({variant:"Treatment",converted:i<140?1:0});} const memo=exportDecisionMemo(analyze(rows),{name:"Checkout",hypothesis:"Fewer fields improve conversion",primaryMetric:"conversion"}); assert.match(memo,/Evidence note/); });
