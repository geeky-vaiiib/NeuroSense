"""Download only the explicitly licensed fixed-version sources. Never accesses DASD.

Raw, identifiable data stay under ignored research-data/. No upload or redistribution.
"""
from pathlib import Path
from urllib.request import Request,urlopen
import argparse,hashlib,json,os,zipfile
ROOT=Path(__file__).resolve().parents[2]/'research-data'
SOURCES={
 'gaze':('https://ndownloader.figshare.com/files/35980367','gaze_figshare_v1.zip','md5','76b48bb15197a75c9ff9231d4ccb4f58','CC BY 4.0','https://figshare.com/articles/dataset/20113592'),
 'speech':('https://zenodo.org/api/records/1188976/files/Audio_Speech_Actors_01-24.zip/content','ravdess_speech_v1.zip','md5','bc696df654c87fed845eb13823edef8a','CC BY-NC-SA 4.0; noncommercial only','https://zenodo.org/records/1188976'),
 'facial':('https://github.com/atomashevic/emotion-course-data/releases/download/v1.0/module3-v-expression.zip','v_expression_course_v1.zip','sha256','164eaab6256d36c1f548c2797aefe3b696a373676aa20beecc1a4f3c960699d1','CC BY 4.0, attributed resized redistribution','https://data.mendeley.com/datasets/9gr9cn3bbn/1')}

def safe_extract(archive,destination):
 destination=Path(destination).resolve()
 with zipfile.ZipFile(archive) as z:
  if sum(m.file_size for m in z.infolist())>4*1024**3:raise ValueError('archive exceeds 4GiB extraction budget')
  for m in z.infolist():
   target=(destination/m.filename).resolve()
   if destination not in target.parents and target!=destination:raise ValueError('unsafe archive path')
   if (m.external_attr>>16)&0o170000==0o120000:raise ValueError('archive symlink refused')
  z.extractall(destination)

def download(task):
 url,name,algorithm,expected,licence,source=SOURCES[task];folder=ROOT/'downloads';folder.mkdir(parents=True,exist_ok=True);dest=folder/name
 if not dest.exists():
  part=dest.with_suffix('.part')
  with urlopen(Request(url,headers={'User-Agent':'NeuroSense-noncommercial-research/1.0'}),timeout=120) as response,part.open('wb') as out:
   while chunk:=response.read(1024**2):out.write(chunk)
  part.rename(dest)
 content=dest.read_bytes()
 if hashlib.new(algorithm,content).hexdigest()!=expected:raise ValueError(f'{task} archive checksum mismatch')
 target=ROOT/('ravdess' if task=='speech' else task)
 if not target.exists():safe_extract(dest,target)
 evidence={'source':source,'download_url':url,'licence':licence,'size':len(content),'provider_checksum':{algorithm:expected},'sha256':hashlib.sha256(content).hexdigest()}
 (ROOT/'metadata').mkdir(exist_ok=True);(ROOT/'metadata'/f'{task}_verified_download.json').write_text(json.dumps(evidence,indent=2))
 print(task,'verified',evidence['sha256'])
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--task',choices=SOURCES,required=True);a=p.parse_args();os.umask(0o077);download(a.task)
