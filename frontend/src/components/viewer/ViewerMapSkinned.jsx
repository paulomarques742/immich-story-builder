import ViewerMapMemoire from './ViewerMapMemoire';
import ViewerMapGhost from './ViewerMapGhost';
import ViewerMapStandard from './ViewerMapStandard';

export default function ViewerMapSkinned({ content, onViewChange, onMapClick }) {
  const skin = content.skin || 'standard';
  if (skin === 'ghost')   return <ViewerMapGhost   content={content} />;
  if (skin === 'memoire') return <ViewerMapMemoire content={content} />;
  return <ViewerMapStandard content={content} onViewChange={onViewChange} onMapClick={onMapClick} />;
}
