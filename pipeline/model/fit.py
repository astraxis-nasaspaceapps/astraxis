import json, numpy as np
from pathlib import Path
HERE = Path(__file__).parent
DATA = HERE.parents[1] / 'src' / 'data'
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.model_selection import RepeatedStratifiedKFold, cross_validate
from sklearn.dummy import DummyClassifier
T=json.load(open(DATA / 'tests.json'))
F=[t for t in T if t['acronym']=='FLEX' and t['pressure_atm'] is not None and t['droplet_initial_diameter_mm'] is not None and t['o2_initial_pct'] is not None]
FEAT=['o2','p','heptane','co2','he','d0']
def row(t): return [t['o2_initial_pct'],t['pressure_atm'],1.0 if t['fuel_or_material']=='Heptane' else 0.0,t['co2_initial_pct'] or 0.0,t['he_initial_pct'] or 0.0,t['droplet_initial_diameter_mm']]
X=np.array([row(t) for t in F]); y=np.array([1 if t['test_end']=='Extinction' else 0 for t in F])
print('n',len(y),'flame-out rate',y.mean().round(3))
for c in range(len(FEAT)): print(FEAT[c], X[:,c].min(), X[:,c].max())
cv=RepeatedStratifiedKFold(n_splits=5,n_repeats=20,random_state=0)
sc=['accuracy','roc_auc','neg_brier_score']
models={'majority':DummyClassifier(strategy='most_frequent'),
 'o2 only':make_pipeline(StandardScaler(),LogisticRegression(max_iter=1000)),
 'logistic (all)':make_pipeline(StandardScaler(),LogisticRegression(max_iter=1000,C=1.0)),
 'gradient boosting':GradientBoostingClassifier(random_state=0)}
res={}
for name,m in models.items():
    Xm=X[:,[0]] if name=='o2 only' else X
    r=cross_validate(m,Xm,y,cv=cv,scoring=sc)
    res[name]={k:float(np.mean(r['test_'+k])) for k in sc}; res[name]['acc_sd']=float(np.std(r['test_accuracy']))
    print(f"{name:20s} acc {res[name]['accuracy']:.3f}±{res[name]['acc_sd']:.3f} auc {res[name]['roc_auc']:.3f} brier {-res[name]['neg_brier_score']:.3f}")
m=make_pipeline(StandardScaler(),LogisticRegression(max_iter=1000)).fit(X,y)
s=m[0]; lr=m[1]
print('coef (per SD)',dict(zip(FEAT,lr.coef_[0].round(2))),'int',lr.intercept_.round(2))
json.dump({'X':X.tolist(),'y':y.tolist(),'ids':[t['record_id'] for t in F],'res':res,'mean':s.mean_.tolist(),'scale':s.scale_.tolist(),'coef':lr.coef_[0].tolist(),'intercept':float(lr.intercept_[0])},open(HERE / 'fit_out.json','w'))
