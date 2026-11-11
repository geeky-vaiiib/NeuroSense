"""Verify source/data/import isolation without reading any real optional recordings."""
import runpy
from pathlib import Path
import pytest

MODULE = runpy.run_path(str(Path(__file__).resolve().parents[2]/'scripts/check_backend_isolated.py'))


def test_export_preserves_working_code_but_excludes_data_and_secrets(tmp_path):
    root=tmp_path/'source';dest=tmp_path/'export';root.mkdir()
    values={'backend/app.py':'current working edit', '.env':'must not copy',
            '.env.local':'must not copy', '.env.example':'example',
            'backend/DASD-main/dataset/test.csv':'must not copy',
            'research-data/private.wav':'must not copy'}
    for name,value in values.items():
        path=root/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(value)
    MODULE['export_source'](root,dest,values)
    assert (dest/'backend/app.py').read_text()=='current working edit'
    assert (dest/'.env.example').exists()
    assert sorted(str(p.relative_to(dest)) for p in dest.rglob('*') if p.is_file())==['.env.example','backend/app.py']


def test_export_refuses_external_links_and_environment_overrides_production(tmp_path,monkeypatch):
    root=tmp_path/'source';root.mkdir();outside=tmp_path/'outside';outside.write_text('private')
    (root/'link').symlink_to(outside)
    with pytest.raises(ValueError,match='External/symlinked'):
        MODULE['export_source'](root,tmp_path/'export',['link'])
    monkeypatch.setenv('MONGODB_URI','mongodb://forbidden.invalid')
    monkeypatch.setenv('PYTHONPATH','/unrelated/source')
    env=MODULE['isolated_environment'](tmp_path/'export')
    assert env['MONGODB_URI']=='mongomock://isolated-acceptance'
    assert '/unrelated/source' not in env['PYTHONPATH']
    assert env['GAZE_WARMUP']=='0'
