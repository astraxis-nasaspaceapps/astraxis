import json, numpy as np
from pathlib import Path
HERE = Path(__file__).parent
DATA = HERE.parents[1] / 'src' / 'data'
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.model_selection import StratifiedKFold, cross_val_predict
d=json.load(open(HERE / 'fit_out.json')); X=np.array(d['X']); y=np.array(d['y'])
FEAT=['o2','p','heptane','co2','he','d0']
oof=np.zeros(len(y))
for seed in range(20):
    oof+=cross_val_predict(make_pipeline(StandardScaler(),LogisticRegression(max_iter=1000)),X,y,cv=StratifiedKFold(5,shuffle=True,random_state=seed),method='predict_proba')[:,1]
oof/=20
bins=[(12,16),(16,20),(20,24),(24,30),(30,35)]
cal=[]
for lo,hi in bins:
    m=(X[:,0]>=lo)&(X[:,0]<hi)
    cal.append({'band':f'{lo}–{hi-1}% O₂' if hi!=35 else '30–34% O₂','n':int(m.sum()),'observed':round(float(y[m].mean()),3),'predicted':round(float(oof[m].mean()),3)})
print(cal)
r=d['res']
out={'target':'Flame went out (NASA test end = Extinction)','features':FEAT,
 'labels':{'o2':'Initial oxygen (%)','p':'Pressure (atm)','heptane':'Fuel is heptane (vs methanol)','co2':'Added CO₂ (%)','he':'Added helium (%)','d0':'Initial droplet diameter (mm)'},
 'mean':d['mean'],'scale':d['scale'],'coef':d['coef'],'intercept':d['intercept'],
 'ranges':{f:[float(X[:,i].min()),float(X[:,i].max())] for i,f in enumerate(FEAT)},
 'n':int(len(y)),'excluded':274-int(len(y)),'flameOutRate':round(float(y.mean()),3),
 'cv':{'method':'5-fold stratified cross-validation, repeated 20 times','models':[
   {'name':'Always guess the most common outcome','accuracy':round(r['majority']['accuracy'],3),'auc':0.5},
   {'name':'Oxygen only (logistic)','accuracy':round(r['o2 only']['accuracy'],3),'auc':round(r['o2 only']['roc_auc'],3)},
   {'name':'Astraxis model: all six factors (logistic)','accuracy':round(r['logistic (all)']['accuracy'],3),'auc':round(r['logistic (all)']['roc_auc'],3),'brier':round(-r['logistic (all)']['neg_brier_score'],3),'chosen':True},
   {'name':'Gradient boosting (complex, for comparison)','accuracy':round(r['gradient boosting']['accuracy'],3),'auc':round(r['gradient boosting']['roc_auc'],3)}]},
 'calibration':cal}
json.dump(out,open(DATA / 'model_flex.json','w'),ensure_ascii=False,indent=1)
# sanity: habitat-like point
def p(x):
    z=d['intercept']+sum(c*(xi-m)/s for c,xi,m,s in zip(d['coef'],x,d['mean'],d['scale'])); return 1/(1+np.exp(-z))
print('34% 0.71atm methanol N2 3.4mm', round(p([34,0.71,0,0,0,3.4]),3))
print('18% 1atm methanol N2 3.0mm', round(p([18,1.0,0,0,0,3.0]),3))
# Tested ranges per added gas (the app limits its sliders to these)
T=[t for t in json.load(open(DATA / 'tests.json')) if t['acronym']=='FLEX']
m=json.load(open(DATA / 'model_flex.json'))
m['diluentRanges']={'CO2':[min(t['co2_initial_pct'] for t in T if t['diluent']=='CO2'),max(t['co2_initial_pct'] for t in T if t['diluent']=='CO2')],'He':[min(t['he_initial_pct'] for t in T if t['diluent']=='He'),max(t['he_initial_pct'] for t in T if t['diluent']=='He')]}
m['o2ByDiluent']={d:[min(t['o2_initial_pct'] for t in T if t['diluent']==d),max(t['o2_initial_pct'] for t in T if t['diluent']==d)] for d in ['N2','CO2','He']}
json.dump(m,open(DATA / 'model_flex.json','w'),ensure_ascii=False,indent=1)
