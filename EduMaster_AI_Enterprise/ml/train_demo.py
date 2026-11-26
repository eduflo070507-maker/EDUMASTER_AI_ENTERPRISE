"""MLP multitarea didáctica. Los datos generados son SINTÉTICOS y solo sirven para probar el pipeline."""
import argparse, json, random
from pathlib import Path
import numpy as np
import torch
from torch import nn
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, roc_auc_score
import joblib

class EduMasterMLP(nn.Module):
    def __init__(self, n_features=6):
        super().__init__()
        self.shared = nn.Sequential(nn.Linear(n_features, 16), nn.ReLU(), nn.Dropout(.15), nn.Linear(16, 12), nn.ReLU())
        self.completion = nn.Linear(12, 1)
        self.mastery = nn.Linear(12, 3)
        self.support_signal = nn.Linear(12, 1)
        self.recommendation = nn.Linear(12, 4)
    def forward(self, x):
        z = self.shared(x)
        return self.completion(z), self.mastery(z), self.support_signal(z), self.recommendation(z)

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--epochs',type=int,default=30); parser.add_argument('--out',default='artifacts'); args=parser.parse_args()
    random.seed(42); np.random.seed(42); torch.manual_seed(42)
    X=np.random.rand(1500,6).astype('float32')
    y=(.35*X[:,0]+.2*X[:,1]+.2*X[:,2]+.15*X[:,3]-.1*X[:,4]>.42).astype('float32')
    mastery=np.digitize(X[:,0]+X[:,1],bins=[.7,1.3]).astype('int64')
    risk=(X[:,4]>.68).astype('float32')
    rec=np.random.randint(0,4,size=len(X)).astype('int64')
    tr,te=train_test_split(np.arange(len(X)),test_size=.2,random_state=42,stratify=y)
    scaler=StandardScaler(); Xtr=scaler.fit_transform(X[tr]).astype('float32'); Xte=scaler.transform(X[te]).astype('float32')
    model=EduMasterMLP(); opt=torch.optim.AdamW(model.parameters(),lr=1e-3)
    bce=nn.BCEWithLogitsLoss(); ce=nn.CrossEntropyLoss()
    xt=torch.tensor(Xtr); yt=torch.tensor(y[tr]).view(-1,1); mt=torch.tensor(mastery[tr]); rt=torch.tensor(risk[tr]).view(-1,1); rtg=torch.tensor(rec[tr])
    for _ in range(args.epochs):
        model.train(); opt.zero_grad(); a,b,c,d=model(xt); loss=bce(a,yt)+ce(b,mt)+bce(c,rt)+ce(d,rtg); loss.backward(); opt.step()
    model.eval()
    with torch.no_grad():
        logits=model(torch.tensor(Xte))[0].squeeze().numpy(); pred=(1/(1+np.exp(-logits))>.5).astype(int)
    out=Path(args.out); out.mkdir(parents=True,exist_ok=True); torch.save(model.state_dict(),out/'edumaster_multitask_demo.pt'); joblib.dump(scaler,out/'scaler_demo.joblib')
    metrics={'accuracy_demo':float(accuracy_score(y[te],pred)),'roc_auc_demo':float(roc_auc_score(y[te],logits)),'dataset':'synthetic-demo','warning':'NO usar como evidencia de calidad predictiva educativa'}
    (out/'metrics_demo.json').write_text(json.dumps(metrics,indent=2),encoding='utf-8'); print(json.dumps(metrics,indent=2))
if __name__=='__main__': main()
