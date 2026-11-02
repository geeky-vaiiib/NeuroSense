import numpy as np
from sklearn.linear_model import LogisticRegression
from backend.ml.lime_engine import compute_lime


def test_lime_positive_legacy_label_is_reproducible_even_below_threshold():
    rng=np.random.default_rng(1)
    x=rng.normal(size=(100,3)); y=(x[:,0]>0).astype(int)
    model=LogisticRegression().fit(x,y)
    row=np.array([[-3.,0.,0.]])
    a=compute_lime(model,row,x,['F1','F2','F3'])
    b=compute_lime(model,row,x,['F1','F2','F3'])
    assert a and a==b
