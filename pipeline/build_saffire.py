"""Clean NASA PSI SAFFIRE I-III experimental tables (PSI-98, PSI-99, PSI-100) into src/data/saffire.json.
Rules: keep NASA's raw text for every value; never change a value; record every issue as a flag."""
import csv, json, io, sys
from pathlib import Path
HERE = Path(__file__).parent
RAW = str(HERE / 'raw' / 'saffire') + '/'
DATA = HERE.parent / 'src' / 'data'
def rows(fn):
    with open(RAW+fn, encoding='utf-8', newline='') as f: return list(csv.reader(f))
log=[]
def flag(rec, field, issue): log.append({'record_id':rec,'field':field,'issue':issue})

inv=[{'id':'PSI-98','acronym':'SAFFIRE-I','title':'Spacecraft Fire Safety Experiment-I','doi':'10.60555/0t15-1z43','file':'PSI-98_Experimental table_SAFFIRE-1.csv'},
     {'id':'PSI-99','acronym':'SAFFIRE-II','title':'Spacecraft Fire Experiment-II','doi':'10.60555/2chp-m469','file':'PSI-99_Experimental table_SAFFIRE-2.csv'},
     {'id':'PSI-100','acronym':'SAFFIRE-III','title':'Spacecraft Fire Experiment-III','doi':'10.60555/040q-4h36','file':'PSI-100_Experimental table_SAFFIRE-3.csv'}]
samples=[]
# SAFFIRE-I and III: large SIBAL sheets
for i,(fn,inv_id,acr) in enumerate([(inv[0]['file'],'PSI-98','SAFFIRE-I'),(inv[2]['file'],'PSI-100','SAFFIRE-III')]):
    r=rows(fn); h=[c.strip() for c in r[0]]
    for row in r[1:]:
        if not row or not row[0].strip().startswith('S'): continue
        d=dict(zip(h,[c.strip() for c in row])); rid=f"{inv_id}:{d['Sample Number']}"
        samples.append({'record_id':rid,'investigation_id':inv_id,'acronym':acr,'sample':d['Sample Number'],
          'material':d['Material'],'thickness':d.get('Sample Thickness (cm)',d.get('Sample Thickness')),
          'size':f"{d.get('Sample Length (cm)',d.get('Sample Length'))} × {d.get('Sample Width (cm)',d.get('Sample Width'))}",
          'airflow':d.get('Air Flow (cm/s)',d.get('Air Flow')),'direction':d.get('Flow Direction',d.get('Direction')),
          'o2':d.get('Percent O2'),'burn_time':d.get('Burn Time (s)'),'ug_burn_length':None,'ug_spread':None,'g1_burn_length':None,'g1_spread':None,'comparison':None})
        if inv_id=='PSI-98': flag(rid,'size','Units as in NASA header: thickness, length and width in cm (length 40.6, width 94 in the table).')
        if inv_id=='PSI-100': flag(rid,'o2','No oxygen, burn time or burn length columns in NASA\'s SAFFIRE-III table: conditions only.')
# SAFFIRE-II: 9 samples with microgravity vs 1-g comparison
r=rows(inv[1]['file']); h=[c.strip() for c in r[0]]
UG_B,UG_S=h[11],h[12]
notes={}
for row in r:
    if row and row[0].startswith('Note '): notes[row[0][:6]]=row[0]
CMP={'2-1':'less','2-2':'less','2-3':'neither','2-4':'less','2-5':'full_both','2-6':'full_both','2-7':'not_comparable','2-8':'less','2-9':'less'}
for row in r[1:]:
    if not row or not row[0].startswith('2-'): continue
    d=dict(zip(h,[c.strip() for c in row])); rid=f"PSI-99:{d['Sample Number']}"
    s={'record_id':rid,'investigation_id':'PSI-99','acronym':'SAFFIRE-II','sample':d['Sample Number'],'material':d['Material'] or None,
       'thickness':d['Samle Thickness'],'size':f"{d['Sample Length']} × {d['Sample Width (cm)']} cm",'airflow':d['Air Flow (cm/s)'],
       'direction':d['Flow Direction'],'o2':d['Percent O2 (Note 1)'],'burn_time':d['Burn Time (s)'],
       'ug_burn_length':d[UG_B],'ug_spread':d[UG_S],'g1_burn_length':d['1-g Burn Length'],'g1_spread':d['1-g Spread Rate'],'comparison':CMP[d['Sample Number']]}
    samples.append(s)
    if not s['material']: flag(rid,'material','Material is blank in NASA\'s table (it may match the row above, but the table does not say).')
    if s['thickness'].startswith('037'): flag(rid,'thickness','NASA\'s table reads "037 mm"; very likely 0.37 mm, shown as written.')
    if s['thickness']=='See Fig. 5': flag(rid,'thickness','Thickness refers to a figure not included in the table.')
flag('PSI-99:*',UG_B,'Column header reads "?-g" in NASA\'s file (a character lost in encoding). It pairs with the 1-g columns, so Astraxis labels it microgravity.')
flag('PSI-99:*','o2','NASA Note 1: '+notes.get('Note 1',''))
flag('PSI-99:2-7','ug_burn_length','NASA Note 2: '+notes.get('Note 2',''))
flag('PSI-99:2-8','ug_burn_length','NASA Note 3: '+notes.get('Note 3',''))
flag('PSI-99:2-9','ug_burn_length','NASA cites Note 4 here; Note 3 (damage length) may be meant. '+notes.get('Note 4',''))
from collections import Counter
c=Counter(s['comparison'] for s in samples if s['investigation_id']=='PSI-99')
out={'investigations':inv,'samples':samples,'cleaning_log':log,'notes':list(notes.values()),
     'comparison_rule':'Microgravity vs 1-g burn length per SAFFIRE-II sample: "less" when the microgravity burn length is smaller than the 1-g one; "full_both" when both burned the full sample; "neither" when both are about 0; "not_comparable" when the two columns describe different materials.',
     'summary':dict(c)}
json.dump(out,open(DATA / 'saffire.json','w'),ensure_ascii=False,indent=1)
print(len(samples),'samples',dict(c),len(log),'flags')
