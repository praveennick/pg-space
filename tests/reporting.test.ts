import { expect, it } from 'vitest'
import { demoData } from '../src/data/seed'
import { scopeRooms } from '../src/domain/reporting'
import { metrics, balance } from '../src/domain/calculations'
import { monthNow, today, stamp } from '../src/domain/models'
import { validateBackup } from '../src/services/application'
it('scopes rent totals and deposit liabilities to the selected room',()=>{const s=demoData(),room=s.rooms.find(r=>s.occupancies.some(o=>s.beds.some(b=>b.id===o.bedId&&b.roomId===r.id)))!,view=scopeRooms(s,'all',room.id),m=metrics(view,`${monthNow()}-01`,today());expect(view.rooms).toHaveLength(1);expect(view.invoices.every(i=>view.occupancies.some(o=>o.id===i.occupancyId))).toBe(true);expect(m.pending).toBe(view.invoices.filter(i=>i.month===monthNow()).reduce((v,i)=>v+balance(view,i),0));expect(m.billed).toBeLessThan(metrics(s,`${monthNow()}-01`,today()).billed)})
it('rejects an active reservation pointing at a retired bed',()=>{const s=demoData(),bed=s.beds.find(b=>!s.occupancies.some(o=>o.bedId===b.id)&&!s.reservations.some(r=>r.bedId===b.id)&&!s.tickets.some(t=>t.bedId===b.id))!;s.beds.push({...bed,...stamp(),retired:true});s.reservations.push({...stamp(),bedId:s.beds.at(-1)!.id,name:'Demo invalid',phone:'9000000000',checkIn:today(),expires:today(),amount:0,status:'Confirmed',notes:''});expect(()=>validateBackup({version:1,data:s})).toThrow('missing or conflicting records')})
