import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { pathToFileURL } from 'node:url'
const root=resolve(import.meta.dirname, '..')
const {openWindow}=await import(pathToFileURL(resolve(root,'src/web/window.ts')))
const url='http://127.0.0.1:48115/?t=secret&mode=1'
function setup({window=true, web=false, pane=false, launch='nonzero', shown=false}={}) {
 const state={web:{status:'listening',port:48115,token:'secret'},view:{chosen:true,isShown:shown,web,window,pane}}
 const calls=[], toasts=[], statuses=[], updates=[]
 const process={run:async argv=>{
  calls.push(argv)
  if(JSON.stringify(argv)===JSON.stringify(['which','chromium'])) return {exitCode:0}
  if(argv[0]==='chromium') {
   if(launch==='throw') throw Error('spawn denied')
   return {exitCode:launch==='success'?0:7}
  }
  return {exitCode:1}
 }}
 const $={process,ui:{toast:s=>toasts.push(s),status:s=>statuses.push(s),ask:async()=>'',open:async()=>{}}}
 const INITIAL_WEB={status:'starting'},INITIAL_VIEW={chosen:false},PANE='agent-tree'
 const atoms= {atom: (_def, init)=> ({key:_def.key,init}),read:async(_$,x)=>state[x.key],update:async(_$,x,fn)=>{state[x.key]=fn(state[x.key]);updates.push({key:x.key,value:structuredClone(state[x.key])})}}
 let source=readFileSync(resolve(root,'src/view.ts'),'utf8')
 source=source.replace(/^import.*\n/gm,'').replaceAll(' as const','').replaceAll(': EngineInterface','')
 source=source.replace(/export async function (\w+)\(/g,'async function $1(')
 source+='\n;globalThis.testReveal = reveal;'
 const context={...atoms,INITIAL_WEB,INITIAL_VIEW,PANE,openWindow,canOpenWindow:async()=>true,QUESTION:'q',optionsFor:x=>[],parseChoice:x=>({window:true}),pageUrl:(port,token)=>`http://127.0.0.1:${port}/?t=${token}&mode=1`,console}
 runInNewContext(source,context,{filename:'view.source-transformed.mjs'})
 return {state,$,calls,toasts,statuses,updates,reveal:()=>context.testReveal($)}
}
test('window-only failed exit restores retryable isShown and reports error',async()=>{
 const x=setup();await x.reveal();assert.equal(x.state.view.isShown,false);assert.match(x.toasts.at(-1),/could not be opened/);assert.deepEqual(x.calls.at(-1),['chromium',`--app=${url}`]);await x.reveal();assert.equal(x.calls.filter(a=>a[0]==='chromium').length,2)
})
test('window-only spawn rejection restores retryable isShown',async()=>{const x=setup({launch:'throw'});await x.reveal();assert.equal(x.state.view.isShown,false)})
test('successful window remains marked shown; no repeated launch',async()=>{const x=setup({launch:'success'});await x.reveal();assert.equal(x.state.view.isShown,true);await x.reveal();assert.equal(x.calls.filter(a=>a[0]==='chromium').length,1);assert.equal(x.toasts.length,0)})
test('web output remains shown even when auxiliary window fails',async()=>{const x=setup({web:true});await x.reveal();assert.equal(x.state.view.isShown,true);assert.equal(x.toasts.length,1);assert.equal(x.statuses.length,1)})
test('pane output remains shown even when auxiliary window fails',async()=>{const x=setup({pane:true});await x.reveal();assert.equal(x.state.view.isShown,true);assert.equal(x.toasts.length,0)})
test('already shown suppresses a second launch',async()=>{const x=setup({shown:true});await x.reveal();assert.equal(x.calls.length,0)})
